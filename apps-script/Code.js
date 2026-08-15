/************************************
 * Managed from this repository and deployed to Google Apps Script with clasp.
 ************************************/

/************************************
 * AXIS CHECK-IN SYSTEM
 *
 * Основные части:
 * 1. WEB_APP_URL      - ссылка на Web App
 * 2. doGet(e)         - экран чек-ина
 * 3. addAttendance()  - запись посещения
 * 4. getMemberName()  - получить имя ученика
 * 5. generateQRUrls() - создать QR/URL ссылки в таблице
 ************************************/


/**
 * Главная ссылка Web App.
 * Если когда-нибудь поменяется deployment URL,
 * меняем ссылку только здесь, а не по всему коду.
 */
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycby_D4IOfvuZbyheCOxZINd5x2tX6DD6iv6AtDOwcxSDgmYHq0jjjKytEDLOxBfGezJiKw/exec";


// GitHub Pages scanner page
const SCANNER_PAGE_URL = "https://shams1986.github.io/axis-checkin-scanner/";

// Cache for stable sheets in seconds.
// This makes scanner faster, but changes in Mitglieder / Checkin_Content
// may take up to this many seconds to appear unless clearFastCheckinCache() is run.
const FAST_CACHE_SECONDS = 60;





/**
 * doGet(e)
 *
 * Главная функция Web App.
 *
 * Теперь она работает в двух основных режимах:
 *
 * 1. Обычный HTML-режим:
 *    WEB_APP_URL?id=AJJ001
 *
 *    Используется, если кто-то напрямую открыл QR-ссылку.
 *    Показывает экран:
 *    - Check-In erfolgreich
 *    - Bereits eingecheckt
 *    - Mitglied nicht gefunden
 *
 *
 * 2. API-режим для GitHub Scanner:
 *    WEB_APP_URL?api=checkin&id=AJJ001&callback=...
 *
 *    Используется GitHub Scanner page.
 *    В этом режиме Apps Script НЕ показывает страницу.
 *    Он только возвращает данные:
 *    - result
 *    - memberId
 *    - vorname
 *    - title
 *    - subtitle
 *    - color
 *    - sound
 *
 *    GitHub Scanner сам показывает красивый экран,
 *    играет звук и остаётся с включённой камерой.
 */
function doGet(e) {

  // Получаем MemberID из URL.
  const memberId = e.parameter.id;

  // Проверяем, пришёл ли запрос как API-запрос от GitHub Scanner.
  const apiMode = e.parameter.api === "checkin";

  // JSONP callback нужен, чтобы GitHub page могла получить ответ от Apps Script.
  const callback = e.parameter.callback || "callback";

  // Старый scannerMode оставляем для совместимости.
  const scannerMode = e.parameter.scanner === "1";


  // ==================================================
  // FAST API MODE ДЛЯ GITHUB SCANNER
  // ==================================================
  if (apiMode) {

    // Если MemberID не пришёл, сразу возвращаем ошибку.
    // Здесь не читаем таблицы вообще, чтобы не тратить время.
    if (!memberId) {
      return createJsonpResponse(callback, {
        result: "not_found",
        memberId: "",
        vorname: "",
        title: "❌ Mitglied nicht gefunden",
        subtitle: "QR Code enthält keine MemberID.",
        color: "#F44336",
        sound: "error",
        message: "",
        contentId: "",
        messageSource: "",
        missedTrainingDays: 0,
        trainingType: "",
        trainingName: "",
        trainingAudience: ""
      });
    }

    // Быстрый check-in:
    // - берёт данные ученика
    // - проверяет duplicate через Checkin_State
    // - считает missedTrainingDays
    // - выбирает сообщение
    // - записывает Attendance сразу полной строкой
    const responseData = processFastCheckinApi(memberId);

    // Возвращаем данные обратно на GitHub Scanner.
    return createJsonpResponse(callback, responseData);
  }


  // ==================================================
  // ОБЫЧНЫЙ HTML CHECK-IN
  // ==================================================
  if (memberId) {

    // Старый прямой HTML-режим оставляем для совместимости.
    // Основной быстрый режим теперь GitHub Scanner API выше.
    const attendanceResult = addAttendance(memberId);

    const vorname = getMemberName(memberId);

    let statusText = "✓ Check-In erfolgreich";
    let statusColor = "#4CAF50";
    let subtitleText = "Willkommen zum Training!";

    if (attendanceResult === "duplicate") {
      statusText = "⚠ Bereits eingecheckt";
      statusColor = "#FFC107";
      subtitleText = "Du bist bereits angemeldet.";
    }

    if (attendanceResult === "not_found") {
      statusText = "❌ Mitglied nicht gefunden";
      statusColor = "#F44336";
      subtitleText = "Bitte Trainer informieren.";
    }

    const returnUrl = scannerMode
      ? SCANNER_PAGE_URL
      : WEB_APP_URL;

    return HtmlService.createHtmlOutput(`
      <html>
        <body style="
          background:#2f3136;
          color:white;
          font-family:Arial,sans-serif;
          text-align:center;
          padding-top:80px;
        ">

          <h1 style="font-size:60px;">
            AXIS JIU-JITSU
          </h1>

          <h2 style="font-size:40px;color:${statusColor};">
            ${statusText}
          </h2>

          <h1 style="font-size:70px;">
            ${vorname}
          </h1>

          <p style="font-size:28px;">
            ${subtitleText}
          </p>

          <script>
            setTimeout(function() {
              window.location.href = "${returnUrl}";
            }, 5000);
          </script>

        </body>
      </html>
    `);
  }


  // ==================================================
  // СТАРЫЙ SCANNER MODE В APPS SCRIPT
  // ==================================================
  if (scannerMode) {

    // Этот режим больше не основной.
    // Новый scanner работает через GitHub Pages.
    return getScannerHtml();
  }


  // ==================================================
  // ОБЫЧНЫЙ ЭКРАН ОЖИДАНИЯ
  // ==================================================
  return HtmlService.createHtmlOutput(`
    <html>
      <body style="
        background:#2f3136;
        color:white;
        font-family:Arial,sans-serif;
        text-align:center;
        padding-top:100px;
      ">

        <h1 style="font-size:60px;">
          AXIS JIU-JITSU
        </h1>

        <p style="font-size:30px;">
          Scan QR Code
        </p>

      </body>
    </html>
  `);
}









/**
 * createJsonpResponse(callback, data)
 *
 * Возвращает ответ для GitHub Scanner page.
 *
 * Почему JSONP:
 * GitHub Scanner находится на другом сайте:
 * shams1986.github.io
 *
 * Apps Script находится на:
 * script.google.com
 *
 * Обычный JSON может быть заблокирован браузером из-за CORS.
 * JSONP позволяет GitHub Scanner получить данные через script-запрос.
 *
 * callback:
 * имя функции на GitHub Scanner page,
 * которую Apps Script должен вызвать.
 *
 * data:
 * объект с результатом check-in:
 * success / duplicate / not_found
 */
function createJsonpResponse(callback, data) {

  // Защита: разрешаем только безопасное имя callback-функции
  const safeCallback = /^[a-zA-Z_$][0-9a-zA-Z_$]*$/.test(callback)
    ? callback
    : "callback";

  // Превращаем объект в JavaScript-вызов:
  // callback({...});
  const output = safeCallback + "(" + JSON.stringify(data) + ");";

  // Возвращаем JavaScript, а не HTML
  return ContentService
    .createTextOutput(output)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}


/************************************
 * FAST CHECK-IN API CORE
 *
 * Этот блок ускоряет GitHub Scanner API.
 *
 * Главная идея:
 * - не искать последнее посещение по большому Attendance каждый раз
 * - хранить последнее посещение в маленьком листе Checkin_State
 * - писать Attendance сразу полной строкой:
 *   Timestamp | MemberID | Vorname | Nachname | ContentID | MessageSource | MissedTrainingDays
 ************************************/


/**
 * processFastCheckinApi(memberId)
 *
 * Максимально быстрая версия check-in для GitHub Scanner.
 *
 * Делает весь check-in за один общий поток:
 * 1. Берёт ученика из Mitglieder.
 * 2. Берёт последнее посещение из Checkin_State.
 * 3. Проверяет duplicate.
 * 4. Берёт расписание.
 * 5. Считает missedTrainingDays.
 * 6. Выбирает сообщение.
 * 7. Записывает Attendance сразу полной строкой.
 * 8. Обновляет Checkin_State.
 */
function processFastCheckinApi(memberId) {

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const attendanceSheet = ss.getSheetByName("Attendance");
  const scheduleSheet = ss.getSheetByName("Training_Schedule");

  const nowDate = new Date();

  if (!attendanceSheet) {
    return buildFastApiErrorResponse(
      memberId,
      "❌ Systemfehler",
      "Attendance sheet fehlt."
    );
  }

  const membersData = getSheetValuesCached(
    ss,
    "Mitglieder",
    FAST_CACHE_SECONDS
  );

  if (!membersData || membersData.length < 2) {
    return buildFastApiErrorResponse(
      memberId,
      "❌ Systemfehler",
      "Mitglieder sheet fehlt oder ist leer."
    );
  }

  const member = getMemberProfileFastFromData(membersData, memberId);

  if (!member.found) {
    return {
      result: "not_found",
      memberId: memberId,
      vorname: "",
      title: "❌ Mitglied nicht gefunden",
      subtitle: "Bitte Trainer informieren.",
      color: "#F44336",
      sound: "error",
      message: "",
      contentId: "",
      messageSource: "",
      missedTrainingDays: 0,
      messageCycleStatus: "",
      seenSuitableMessages: "",
      trainingType: "",
      trainingName: "",
      trainingStart: "",
      trainingAudience: ""
    };
  }

  const scheduleData = scheduleSheet
    ? scheduleSheet.getDataRange().getValues()
    : [];

  // Neue Logik: Check-In ist nur im Zeitfenster offen:
  // 30 Minuten vor Trainingsstart bis 30 Minuten nach Trainingsstart.
  const currentTraining = getOpenCheckinTrainingFromData(
    scheduleData,
    nowDate,
    member.category
  );

  // Wenn jetzt kein Check-In offen ist, suchen wir die nächste Öffnung heute.
  if (!currentTraining || !currentTraining.isOpen) {

    const nextTraining = getNextCheckinTrainingTodayFromData(
      scheduleData,
      nowDate,
      member.category
    );

    if (nextTraining && nextTraining.displayName) {
      return {
        result: "duplicate",
        memberId: memberId,
        vorname: member.vorname,
        title: "Der nächste Check-In öffnet um " + nextTraining.checkinOpenText + " für " + nextTraining.displayName + ".",
        subtitle: "",
        color: "#FFC107",
        sound: "duplicate",
        message: "",
        contentId: "",
        messageSource: "",
        missedTrainingDays: 0,
        messageCycleStatus: "",
        seenSuitableMessages: "",
        trainingType: nextTraining.trainingType,
        trainingName: nextTraining.displayName,
        trainingStart: nextTraining.trainingStartText,
        trainingAudience: nextTraining.audience
      };
    }

    return {
      result: "duplicate",
      memberId: memberId,
      vorname: member.vorname,
      title: "Kein Check-In möglich",
      subtitle: "Aktuell ist kein Training für Check-In geöffnet.",
      color: "#FFC107",
      sound: "duplicate",
      message: "",
      contentId: "",
      messageSource: "",
      missedTrainingDays: 0,
      messageCycleStatus: "",
      seenSuitableMessages: "",
      trainingType: "",
      trainingName: "",
      trainingStart: "",
      trainingAudience: ""
    };
  }

  const stateSheet = getOrCreateCheckinStateSheet(ss);
  const stateData = stateSheet.getDataRange().getValues();

  const state = getCheckinStateForMember(stateData, memberId);
  const previousAttendanceDate = state.lastCheckin;

  // Duplicate gilt nur für dieselbe konkrete Trainingseinheit.
  if (
    state.lastTrainingKey &&
    currentTraining.trainingKey &&
    String(state.lastTrainingKey) === String(currentTraining.trainingKey)
  ) {
    return {
      result: "duplicate",
      memberId: memberId,
      vorname: member.vorname,
      title: "⚠ Bereits eingecheckt",
      subtitle: "Du bist bereits für " + currentTraining.displayName + " angemeldet.",
      color: "#FFC107",
      sound: "duplicate",
      message: "",
      contentId: "",
      messageSource: "",
      missedTrainingDays: 0,
      messageCycleStatus: "",
      seenSuitableMessages: "",
      trainingType: currentTraining.trainingType,
      trainingName: currentTraining.displayName,
      trainingStart: currentTraining.trainingStartText,
      trainingAudience: currentTraining.audience
    };
  }

  const scheduleDays = getTrainingDaysForCategoryFromData(
    scheduleData,
    member.category
  );

  const missedTrainingDays = calculateMissedTrainingDaysFast(
    previousAttendanceDate,
    scheduleDays,
    nowDate
  );

  const smartMessage = getFastSmartMessage(
    ss,
    member,
    missedTrainingDays,
    currentTraining
  );

  const newAttendanceRow = attendanceSheet.getLastRow() + 1;

  writeAttendanceRowByHeaders(attendanceSheet, newAttendanceRow, {
    Timestamp: nowDate,
    MemberID: memberId,
    Vorname: member.vorname,
    Nachname: member.nachname,
    TrainingType: currentTraining.trainingType,
    TrainingName: currentTraining.displayName,
    TrainingStart: currentTraining.trainingStartText,
    ContentID: smartMessage.contentId,
    MessageSource: smartMessage.source,
    MissedTrainingDays: missedTrainingDays,
    MessageCycleStatus: smartMessage.cycleStatus || "",
    SeenSuitableMessages: smartMessage.seenSuitableMessages || ""
  });

  updateCheckinState(
    stateSheet,
    state,
    memberId,
    nowDate,
    newAttendanceRow,
    currentTraining
  );

  return {
    result: "success",
    memberId: memberId,
    vorname: member.vorname,
    title: "✓ Check-In erfolgreich",
    subtitle: "Willkommen zu " + currentTraining.displayName + "!",
    color: "#4CAF50",
    sound: "success",

    message: formatCheckinMessage(
      member.vorname,
      smartMessage.message,
      smartMessage.source,
      smartMessage.contentKind
    ),
    contentId: smartMessage.contentId,
    messageSource: smartMessage.source,
    missedTrainingDays: missedTrainingDays,
    messageCycleStatus: smartMessage.cycleStatus || "",
    seenSuitableMessages: smartMessage.seenSuitableMessages || "",

    trainingType: currentTraining.trainingType,
    trainingName: currentTraining.displayName,
    trainingStart: currentTraining.trainingStartText,
    trainingAudience: currentTraining.audience
  };
}


/**
 * buildFastApiErrorResponse(memberId, title, subtitle)
 *
 * Единый ответ для системных ошибок.
 */
function buildFastApiErrorResponse(memberId, title, subtitle) {

  return {
    result: "not_found",
    memberId: memberId,
    vorname: "",
    title: title,
    subtitle: subtitle,
    color: "#F44336",
    sound: "error",
    message: "",
    contentId: "",
    messageSource: "",
    missedTrainingDays: 0,
    trainingType: "",
    trainingName: "",
    trainingAudience: ""
  };
}


/**
 * getMemberProfileFastFromData(membersData, memberId)
 *
 * Быстро ищет ученика в уже прочитанных данных Mitglieder.
 *
 * Не открывает таблицу заново.
 */
function getMemberProfileFastFromData(membersData, memberId) {

  const headers = membersData[0];

  const memberIdCol = headers.indexOf("MemberID") !== -1
    ? headers.indexOf("MemberID")
    : 0;

  const vornameCol = headers.indexOf("Vorname") !== -1
    ? headers.indexOf("Vorname")
    : 1;

  const nachnameCol = headers.indexOf("Nachname") !== -1
    ? headers.indexOf("Nachname")
    : 2;

  const categoryCol = headers.indexOf("Kategorie");

  // Возможные названия колонки с датой рождения.
  let birthCol = headers.indexOf("Geburtsdatum");

  if (birthCol === -1) {
    birthCol = headers.indexOf("Geburtstag");
  }

  if (birthCol === -1) {
    birthCol = headers.indexOf("Geburt");
  }

  for (let i = 1; i < membersData.length; i++) {

    const row = membersData[i];

    if (row[memberIdCol] == memberId) {

      const category = categoryCol !== -1
        ? String(row[categoryCol]).trim()
        : "";

      let age = null;

      if (birthCol !== -1 && row[birthCol]) {
        age = calculateAge(row[birthCol]);
      }

      return {
        found: true,
        memberId: memberId,
        vorname: row[vornameCol],
        nachname: row[nachnameCol],
        category: category,
        age: age
      };
    }
  }

  return {
    found: false,
    memberId: memberId,
    vorname: "",
    nachname: "",
    category: "",
    age: null
  };
}


/**
 * getSheetValuesCached(ss, sheetName, ttlSeconds)
 *
 * Читает лист с коротким cache.
 *
 * Используем только для листов, которые не меняются каждую секунду:
 * - Mitglieder
 * - Checkin_Content
 *
 * Attendance НЕ кэшируем.
 * Checkin_State НЕ кэшируем.
 */
function getSheetValuesCached(ss, sheetName, ttlSeconds) {

  const cache = CacheService.getScriptCache();
  const cacheKey = "AXIS_FAST_" + sheetName;

  try {
    const cached = cache.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }
  } catch (error) {
    // Если cache по какой-то причине не прочитался,
    // просто читаем лист напрямую.
  }

  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    return [];
  }

  const values = sheet.getDataRange().getValues();

  try {
    cache.put(cacheKey, JSON.stringify(values), ttlSeconds);
  } catch (error) {
    // Если данные слишком большие для cache,
    // система всё равно работает через прямое чтение.
  }

  return values;
}


/**
 * clearFastCheckinCache()
 *
 * Очищает cache быстрых листов.
 *
 * Запусти вручную, если только что сильно менял:
 * - Mitglieder
 * - Checkin_Content
 *
 * Обычно можно просто подождать FAST_CACHE_SECONDS секунд.
 */
function clearFastCheckinCache() {

  const cache = CacheService.getScriptCache();

  cache.remove("AXIS_FAST_Mitglieder");
  cache.remove("AXIS_FAST_Checkin_Content");
}


/**
 * getOrCreateCheckinStateSheet(ss)
 *
 * Создаёт служебный лист Checkin_State,
 * если его ещё нет.
 *
 * Этот лист нужен для скорости:
 * вместо поиска последнего посещения по большому Attendance
 * мы смотрим маленькую таблицу состояния.
 */
function getOrCreateCheckinStateSheet(ss) {

  let sheet = ss.getSheetByName("Checkin_State");

  if (!sheet) {
    sheet = ss.insertSheet("Checkin_State");
  }

  const headers = [
    "MemberID",
    "LastCheckin",
    "LastAttendanceRow",
    "LastTrainingType",
    "LastTrainingName",
    "LastTrainingStart",
    "LastTrainingKey"
  ];

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return sheet;
  }

  const currentHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headers.length)).getValues()[0];

  for (let i = 0; i < headers.length; i++) {
    if (currentHeaders[i] !== headers[i]) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      break;
    }
  }

  return sheet;
}


/**
 * getCheckinStateForMember(stateData, memberId)
 *
 * Ищет строку ученика в Checkin_State.
 *
 * Возвращает:
 * - rowNumber: номер строки в Checkin_State
 * - lastCheckin: последнее посещение
 */
function getCheckinStateForMember(stateData, memberId) {

  if (!stateData || stateData.length < 2) {
    return {
      found: false,
      rowNumber: null,
      lastCheckin: null,
      lastAttendanceRow: null,
      lastTrainingType: "",
      lastTrainingName: "",
      lastTrainingStart: "",
      lastTrainingKey: ""
    };
  }

  const headers = stateData[0];

  const memberIdCol = headers.indexOf("MemberID");
  const lastCheckinCol = headers.indexOf("LastCheckin");
  const lastAttendanceRowCol = headers.indexOf("LastAttendanceRow");
  const lastTrainingTypeCol = headers.indexOf("LastTrainingType");
  const lastTrainingNameCol = headers.indexOf("LastTrainingName");
  const lastTrainingStartCol = headers.indexOf("LastTrainingStart");
  const lastTrainingKeyCol = headers.indexOf("LastTrainingKey");

  for (let i = 1; i < stateData.length; i++) {

    const row = stateData[i];

    if (row[memberIdCol] == memberId) {
      return {
        found: true,
        rowNumber: i + 1,
        lastCheckin: lastCheckinCol !== -1 ? row[lastCheckinCol] : null,
        lastAttendanceRow: lastAttendanceRowCol !== -1 ? row[lastAttendanceRowCol] : null,
        lastTrainingType: lastTrainingTypeCol !== -1 ? row[lastTrainingTypeCol] : "",
        lastTrainingName: lastTrainingNameCol !== -1 ? row[lastTrainingNameCol] : "",
        lastTrainingStart: lastTrainingStartCol !== -1 ? row[lastTrainingStartCol] : "",
        lastTrainingKey: lastTrainingKeyCol !== -1 ? row[lastTrainingKeyCol] : ""
      };
    }
  }

  return {
    found: false,
    rowNumber: null,
    lastCheckin: null,
    lastAttendanceRow: null,
    lastTrainingType: "",
    lastTrainingName: "",
    lastTrainingStart: "",
    lastTrainingKey: ""
  };
}


/**
 * updateCheckinState(...)
 *
 * Обновляет Checkin_State после успешного check-in.
 *
 * Если строка ученика уже есть — обновляем её.
 * Если строки нет — создаём новую.
 */
function updateCheckinState(
  stateSheet,
  state,
  memberId,
  nowDate,
  attendanceRowNumber,
  currentTraining
) {

  const values = [[
    nowDate,
    attendanceRowNumber,
    currentTraining ? currentTraining.trainingType : "",
    currentTraining ? currentTraining.displayName : "",
    currentTraining ? currentTraining.trainingStartText : "",
    currentTraining ? currentTraining.trainingKey : ""
  ]];

  if (state.found && state.rowNumber) {

    stateSheet
      .getRange(state.rowNumber, 2, 1, 6)
      .setValues(values);

    return;
  }

  const newRow = stateSheet.getLastRow() + 1;

  stateSheet
    .getRange(newRow, 1, 1, 7)
    .setValues([[
      memberId,
      nowDate,
      attendanceRowNumber,
      currentTraining ? currentTraining.trainingType : "",
      currentTraining ? currentTraining.displayName : "",
      currentTraining ? currentTraining.trainingStartText : "",
      currentTraining ? currentTraining.trainingKey : ""
    ]]);
}


/**
 * getFastSmartMessage(...)
 *
 * Быстро выбирает сообщение.
 *
 * Не считает missedTrainingDays заново.
 * Не ищет ученика заново.
 */
function getFastSmartMessage(
  ss,
  member,
  missedTrainingDays,
  currentTraining
) {

  // 1. Сначала персональное сообщение.
  // Personal_Checkin не кэшируем, потому что ShowOnce должен сработать сразу.
  const personal = getPersonalCheckinMessageFast(
    ss,
    member.memberId
  );

  if (personal && personal.message) {
    return {
      message: personal.message,
      contentId: personal.contentId,
      source: personal.source,
      contentKind: personal.contentKind || "personal",

      // Personal-сообщения не входят в обычный цикл Checkin_Content.
      cycleStatus: "personal",
      seenSuitableMessages: ""
    };
  }

  // 2. Потом Checkin_Content через короткий cache.
  const contentData = getSheetValuesCached(
    ss,
    "Checkin_Content",
    FAST_CACHE_SECONDS
  );

  // Выбираем Checkin_Content так, чтобы ученику не повторялись сообщения,
  // пока он не увидит все подходящие для него сообщения.
  return getNonRepeatingCheckinContent(
    ss,
    contentData,
    member,
    missedTrainingDays,
    currentTraining
  );
}


/**
 * getPersonalCheckinMessageFast(ss, memberId)
 *
 * Быстрая версия Personal_Checkin.
 *
 * Если ShowOnce = TRUE, сразу выключает сообщение.
 */
function getPersonalCheckinMessageFast(ss, memberId) {

  const sheet = ss.getSheetByName("Personal_Checkin");

  if (!sheet) {
    return null;
  }

  const data = sheet.getDataRange().getValues();

  if (data.length < 2) {
    return null;
  }

  const headers = data[0];

  const activeCol = headers.indexOf("Active");
  const memberIdCol = headers.indexOf("MemberID");
  const messageCol = headers.indexOf("Message");
  const showOnceCol = headers.indexOf("ShowOnce");
  const usedAtCol = headers.indexOf("UsedAt");

  for (let i = 1; i < data.length; i++) {

    const row = data[i];

    const active = row[activeCol];
    const rowMemberId = row[memberIdCol];
    const message = row[messageCol];
    const showOnce = row[showOnceCol];

    if (
      active === true &&
      rowMemberId == memberId &&
      message
    ) {

      // Если ShowOnce = TRUE,
      // сразу выключаем персональное сообщение.
      if (showOnce === true) {

        sheet
          .getRange(i + 1, activeCol + 1)
          .setValue(false);

        if (usedAtCol !== -1) {
          sheet
            .getRange(i + 1, usedAtCol + 1)
            .setValue(new Date());
        }
      }

      return {
        message: message,
        contentId: "PERSONAL",
        source: "personal",
        contentKind: "personal"
      };
    }
  }

  return null;
}


/**
 * getRandomCheckinContentFastFromData(...)
 *
 * Быстрая версия выбора сообщения из Checkin_Content.
 *
 * Отличие:
 * она НЕ читает таблицу сама.
 * Она работает с уже прочитанным contentData.
 */
function getRandomCheckinContentFastFromData(
  contentData,
  memberProfile,
  missedTrainingDays,
  currentTraining
) {

  // Старую функцию оставляем для совместимости.
  // Новая основная логика теперь в getNonRepeatingCheckinContent().
  return selectCheckinContentFromCandidates(
    contentData,
    memberProfile,
    missedTrainingDays,
    currentTraining
  );
}


/**
 * getNonRepeatingCheckinContent(...)
 *
 * Главная новая логика:
 * один ученик не должен видеть один и тот же ContentID,
 * пока он не увидит все подходящие для него сообщения.
 *
 * Дополнительно возвращает контрольные поля:
 * - cycleStatus: "new" или "cycle_restart"
 * - seenSuitableMessages: например "8/12"
 *
 * Если осталось 5 или меньше новых сообщений,
 * колонка SeenSuitableMessages в Attendance будет красной
 * через conditional formatting.
 */
function getNonRepeatingCheckinContent(
  ss,
  contentData,
  memberProfile,
  missedTrainingDays,
  currentTraining
) {

  // Сначала собираем все подходящие сообщения:
  // comeback, если человек пропустил тренировки;
  // иначе обычные сообщения.
  const selectedPool = selectCheckinContentCandidatePool(
    contentData,
    memberProfile,
    missedTrainingDays,
    currentTraining
  );

  const candidates = selectedPool.candidates;

  if (!candidates || candidates.length === 0) {
    return {
      message: "",
      contentId: "",
      source: "",
      cycleStatus: "",
      seenSuitableMessages: ""
    };
  }

  // Уникальные ContentID среди подходящих сообщений.
  // Weight может дублировать одно сообщение несколько раз,
  // но для счётчика оно должно считаться только один раз.
  const suitableIds = getUniqueContentIds(candidates);
  const totalSuitable = suitableIds.length;

  // Берём или создаём лист состояния сообщений.
  // Это быстрее и чище, чем каждый раз читать всю Attendance.
  const messageStateSheet = getOrCreateCheckinMessageStateSheet(ss);
  const messageStateData = messageStateSheet.getDataRange().getValues();
  const messageState = getCheckinMessageStateForMember(
    messageStateData,
    memberProfile.memberId
  );

  // Список ContentID, которые ученик уже видел в текущем цикле.
  const seenIds = parseSeenContentIds(messageState.seenContentIds);

  // Оставляем в seen только те ID, которые сейчас реально подходят.
  // Это важно, если ты выключил старые сообщения или изменил Category/TrainingType.
  const suitableIdSet = buildSetFromArray(suitableIds);
  const seenSuitableIds = seenIds.filter(function(id) {
    return suitableIdSet[id] === true;
  });

  const seenSet = buildSetFromArray(seenSuitableIds);

  // Новые кандидаты — те, которые ученик ещё не видел.
  const newCandidates = candidates.filter(function(candidate) {
    return seenSet[candidate.contentId] !== true;
  });

  // Нормальный случай:
  // ещё есть новые сообщения.
  if (newCandidates.length > 0) {

    const chosen = pickWeightedRandom(newCandidates);

    const updatedSeenIds = addUniqueId(seenSuitableIds, chosen.contentId);
    const seenAfter = countSeenSuitable(updatedSeenIds, suitableIdSet);

    updateCheckinMessageState(
      messageStateSheet,
      messageState,
      memberProfile.memberId,
      updatedSeenIds,
      "new"
    );

    return {
      message: chosen.message,
      contentId: chosen.contentId,
      source: chosen.source,
      contentKind: chosen.contentKind,
      cycleStatus: "new",
      seenSuitableMessages: seenAfter + "/" + totalSuitable
    };
  }

  // Cycle restart:
  // ученик уже видел все подходящие сообщения.
  // Мы выбираем снова из всех подходящих,
  // но для новой внутренней ротации начинаем новый цикл с выбранного ContentID.
  const repeated = pickWeightedRandom(candidates);

  updateCheckinMessageState(
    messageStateSheet,
    messageState,
    memberProfile.memberId,
    [repeated.contentId],
    "cycle_restart"
  );

  return {
    message: repeated.message,
    contentId: repeated.contentId,
    source: repeated.source,
    contentKind: repeated.contentKind,
    cycleStatus: "cycle_restart",

    // В Attendance специально пишем 12/12,
    // чтобы тебе было видно: старый цикл был полностью пройден.
    seenSuitableMessages: totalSuitable + "/" + totalSuitable
  };
}


/**
 * selectCheckinContentCandidatePool(...)
 *
 * Собирает подходящий набор сообщений.
 *
 * Если missedTrainingDays > 0 и есть comeback-сообщения,
 * берём comeback-пул.
 *
 * Иначе берём обычный пул.
 */
function selectCheckinContentCandidatePool(
  contentData,
  memberProfile,
  missedTrainingDays,
  currentTraining
) {

  if (!contentData || contentData.length < 2) {
    return {
      poolType: "",
      candidates: []
    };
  }

  const headers = contentData[0];

  // Comeback soll erst ab 5 verpassten Trainingstagen greifen.
  // 0–4 verpasste Trainings = normales Check-in-Message.
  if (missedTrainingDays >= 5) {

    const comebackCandidates = buildCheckinContentCandidates(
      contentData,
      headers,
      memberProfile,
      currentTraining,
      true,
      missedTrainingDays
    );

    if (comebackCandidates.length > 0) {
      return {
        poolType: "comeback",
        candidates: comebackCandidates
      };
    }
  }

  const normalCandidates = buildCheckinContentCandidates(
    contentData,
    headers,
    memberProfile,
    currentTraining,
    false,
    missedTrainingDays
  );

  return {
    poolType: "normal",
    candidates: normalCandidates
  };
}


/**
 * selectCheckinContentFromCandidates(...)
 *
 * Простая старая логика:
 * выбрать случайное сообщение из подходящего пула.
 *
 * Оставлена как fallback / совместимость.
 */
function selectCheckinContentFromCandidates(
  contentData,
  memberProfile,
  missedTrainingDays,
  currentTraining
) {

  const selectedPool = selectCheckinContentCandidatePool(
    contentData,
    memberProfile,
    missedTrainingDays,
    currentTraining
  );

  if (!selectedPool.candidates || selectedPool.candidates.length === 0) {
    return {
      message: "",
      contentId: "",
      source: "",
      cycleStatus: "",
      seenSuitableMessages: ""
    };
  }

  const chosen = pickWeightedRandom(selectedPool.candidates);

  return {
    message: chosen.message,
    contentId: chosen.contentId,
    source: chosen.source,
    contentKind: chosen.contentKind,
    cycleStatus: "",
    seenSuitableMessages: ""
  };
}


/**
 * getOrCreateCheckinMessageStateSheet(ss)
 *
 * Служебный лист для ротации сообщений.
 *
 * Одна строка на одного ученика:
 * MemberID | SeenContentIDs | LastCycleStatus | CycleRestartCount | LastUpdate
 */
function getOrCreateCheckinMessageStateSheet(ss) {

  let sheet = ss.getSheetByName("Checkin_Message_State");

  if (!sheet) {
    sheet = ss.insertSheet("Checkin_Message_State");
  }

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, 5).setValues([[
      "MemberID",
      "SeenContentIDs",
      "LastCycleStatus",
      "CycleRestartCount",
      "LastUpdate"
    ]]);
  }

  const firstCell = sheet.getRange(1, 1).getValue();

  if (firstCell !== "MemberID") {
    sheet.getRange(1, 1, 1, 5).setValues([[
      "MemberID",
      "SeenContentIDs",
      "LastCycleStatus",
      "CycleRestartCount",
      "LastUpdate"
    ]]);
  }

  return sheet;
}


/**
 * getCheckinMessageStateForMember(...)
 *
 * Ищет состояние сообщений ученика.
 */
function getCheckinMessageStateForMember(stateData, memberId) {

  if (!stateData || stateData.length < 2) {
    return {
      found: false,
      rowNumber: null,
      seenContentIds: "",
      lastCycleStatus: "",
      cycleRestartCount: 0
    };
  }

  const headers = stateData[0];

  const memberIdCol = headers.indexOf("MemberID");
  const seenContentIdsCol = headers.indexOf("SeenContentIDs");
  const lastCycleStatusCol = headers.indexOf("LastCycleStatus");
  const cycleRestartCountCol = headers.indexOf("CycleRestartCount");

  for (let i = 1; i < stateData.length; i++) {

    const row = stateData[i];

    if (row[memberIdCol] == memberId) {
      return {
        found: true,
        rowNumber: i + 1,
        seenContentIds: row[seenContentIdsCol],
        lastCycleStatus: lastCycleStatusCol !== -1 ? row[lastCycleStatusCol] : "",
        cycleRestartCount: cycleRestartCountCol !== -1
          ? Number(row[cycleRestartCountCol]) || 0
          : 0
      };
    }
  }

  return {
    found: false,
    rowNumber: null,
    seenContentIds: "",
    lastCycleStatus: "",
    cycleRestartCount: 0
  };
}


/**
 * updateCheckinMessageState(...)
 *
 * Обновляет состояние цикла сообщений ученика.
 */
function updateCheckinMessageState(
  sheet,
  state,
  memberId,
  seenIds,
  cycleStatus
) {

  const seenText = seenIds.join(",");
  const now = new Date();

  const cycleRestartCount = cycleStatus === "cycle_restart"
    ? (Number(state.cycleRestartCount) || 0) + 1
    : (Number(state.cycleRestartCount) || 0);

  if (state.found && state.rowNumber) {

    sheet
      .getRange(state.rowNumber, 2, 1, 4)
      .setValues([[
        seenText,
        cycleStatus,
        cycleRestartCount,
        now
      ]]);

    return;
  }

  const newRow = sheet.getLastRow() + 1;

  sheet
    .getRange(newRow, 1, 1, 5)
    .setValues([[
      memberId,
      seenText,
      cycleStatus,
      cycleRestartCount,
      now
    ]]);
}


/**
 * parseSeenContentIds(value)
 *
 * Превращает "C001,C002,C003" в массив.
 */
function parseSeenContentIds(value) {

  if (!value) {
    return [];
  }

  return String(value)
    .split(",")
    .map(function(item) {
      return item.trim();
    })
    .filter(function(item) {
      return item !== "";
    });
}


/**
 * getUniqueContentIds(candidates)
 *
 * Возвращает уникальные ContentID из списка кандидатов.
 */
function getUniqueContentIds(candidates) {

  const set = {};
  const result = [];

  for (let i = 0; i < candidates.length; i++) {

    const id = String(candidates[i].contentId).trim();

    if (!id || set[id]) {
      continue;
    }

    set[id] = true;
    result.push(id);
  }

  return result;
}


/**
 * buildSetFromArray(items)
 *
 * Делает быстрый lookup-объект:
 * ["C001", "C002"] → { C001: true, C002: true }
 */
function buildSetFromArray(items) {

  const set = {};

  for (let i = 0; i < items.length; i++) {
    set[String(items[i]).trim()] = true;
  }

  return set;
}


/**
 * addUniqueId(items, id)
 *
 * Добавляет id в массив, если его ещё нет.
 */
function addUniqueId(items, id) {

  const set = buildSetFromArray(items);
  const cleanId = String(id).trim();

  if (!set[cleanId]) {
    items.push(cleanId);
  }

  return items;
}


/**
 * countSeenSuitable(seenIds, suitableIdSet)
 *
 * Считает, сколько из seenIds сейчас ещё подходят.
 */
function countSeenSuitable(seenIds, suitableIdSet) {

  let count = 0;

  for (let i = 0; i < seenIds.length; i++) {

    const id = String(seenIds[i]).trim();

    if (suitableIdSet[id] === true) {
      count++;
    }
  }

  return count;
}


/**
 * getCurrentTrainingFromData(scheduleData, nowDate)
 *
 * Быстрая версия getCurrentTraining().
 *
 * Не открывает Training_Schedule заново.
 * Использует уже прочитанный scheduleData.
 */
function getCurrentTrainingFromData(scheduleData, nowDate) {

  // Alte Kompatibilitätsfunktion.
  // Für den schnellen Scanner verwenden wir jetzt getOpenCheckinTrainingFromData().
  return getOpenCheckinTrainingFromData(scheduleData, nowDate, "");
}


/**
 * getOpenCheckinTrainingFromData(scheduleData, nowDate, category)
 *
 * Findet die Trainingseinheit, deren Check-In-Fenster jetzt offen ist.
 * Fenster: 30 Minuten vor Start bis 30 Minuten nach Start.
 */
function getOpenCheckinTrainingFromData(scheduleData, nowDate, category) {

  const trainings = buildTrainingWindowsForToday(scheduleData, nowDate, category);
  const currentMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();

  for (let i = 0; i < trainings.length; i++) {
    const training = trainings[i];

    if (
      currentMinutes >= training.checkinOpenMinutes &&
      currentMinutes <= training.checkinCloseMinutes
    ) {
      training.isOpen = true;
      return training;
    }
  }

  return {
    isOpen: false,
    trainingType: "",
    displayName: "",
    audience: "",
    trainingStartText: "",
    trainingKey: ""
  };
}


/**
 * getNextCheckinTrainingTodayFromData(scheduleData, nowDate, category)
 *
 * Wenn jetzt kein Check-In offen ist, findet diese Funktion die nächste
 * Trainingseinheit heute, deren Check-In-Fenster später öffnet.
 */
function getNextCheckinTrainingTodayFromData(scheduleData, nowDate, category) {

  const trainings = buildTrainingWindowsForToday(scheduleData, nowDate, category);
  const currentMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();

  for (let i = 0; i < trainings.length; i++) {
    const training = trainings[i];

    // Важно:
    // показываем next check-in только если окно откроется позже СЕГОДНЯ.
    // Завтрашние тренировки здесь вообще не рассматриваются.
    if (training.checkinOpenMinutes > currentMinutes) {
      return training;
    }
  }

  // Если сегодня больше нет подходящего check-in окна
  return null;
}


/**
 * buildTrainingWindowsForToday(scheduleData, nowDate, category)
 *
 * Baut alle passenden Trainingsfenster für heute.
 */
function buildTrainingWindowsForToday(scheduleData, nowDate, category) {

  if (!scheduleData || scheduleData.length < 2) {
    return [];
  }

  const headers = scheduleData[0];

  const activeCol = headers.indexOf("Active");
  const trainingTypeCol = headers.indexOf("TrainingType");
  const displayNameCol = headers.indexOf("DisplayName");
  const dayOfWeekCol = headers.indexOf("DayOfWeek");
  const startTimeCol = headers.indexOf("StartTime");
  const audienceCol = headers.indexOf("Audience");

  const currentDayNumber = nowDate.getDay();
  const result = [];

  for (let i = 1; i < scheduleData.length; i++) {

    const row = scheduleData[i];

    const active = row[activeCol];
    const dayOfWeek = row[dayOfWeekCol];
    const audience = row[audienceCol];

    if (active !== true) {
      continue;
    }

    const rowDayNumber = dayNameToNumber(dayOfWeek);

    if (rowDayNumber !== currentDayNumber) {
      continue;
    }

    if (category && !valueMatchesList(audience, category)) {
      continue;
    }

    const startMinutes = timeToMinutes(row[startTimeCol]);

    if (isNaN(startMinutes)) {
      continue;
    }

    const trainingType = row[trainingTypeCol] || "";
    const displayName = row[displayNameCol] || trainingType || "Training";
    const trainingStartText = minutesToTimeText(startMinutes);

    result.push({
      isOpen: false,
      trainingType: trainingType,
      displayName: displayName,
      audience: audience,
      startMinutes: startMinutes,
      checkinOpenMinutes: startMinutes - 30,
      checkinCloseMinutes: startMinutes + 30,
      checkinOpenText: minutesToTimeText(startMinutes - 30),
      checkinCloseText: minutesToTimeText(startMinutes + 30),
      trainingStartText: trainingStartText,
      trainingKey: buildTrainingKey(nowDate, trainingType, trainingStartText)
    });
  }

  result.sort(function(a, b) {
    return a.startMinutes - b.startMinutes;
  });

  return result;
}


/**
 * buildTrainingKey(date, trainingType, trainingStartText)
 *
 * Eindeutiger Schlüssel für eine Trainingseinheit an einem Datum.
 */
function buildTrainingKey(date, trainingType, trainingStartText) {

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");

  return yyyy + "-" + mm + "-" + dd + "|" + String(trainingType) + "|" + String(trainingStartText);
}


/**
 * minutesToTimeText(minutes)
 *
 * 1140 → "19:00"
 */
function minutesToTimeText(minutes) {

  let safeMinutes = Number(minutes);

  while (safeMinutes < 0) {
    safeMinutes += 24 * 60;
  }

  safeMinutes = safeMinutes % (24 * 60);

  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;

  return String(hours).padStart(2, "0") + ":" + String(mins).padStart(2, "0");
}


/**
 * getTrainingDaysForCategoryFromData(scheduleData, category)
 *
 * Быстрая версия getTrainingDaysForCategory().
 *
 * Не читает Training_Schedule заново.
 */
function getTrainingDaysForCategoryFromData(scheduleData, category) {

  if (!scheduleData || scheduleData.length < 2) {
    return [];
  }

  const headers = scheduleData[0];

  const activeCol = headers.indexOf("Active");
  const dayOfWeekCol = headers.indexOf("DayOfWeek");
  const audienceCol = headers.indexOf("Audience");

  const daySet = {};

  for (let i = 1; i < scheduleData.length; i++) {

    const row = scheduleData[i];

    const active = row[activeCol];
    const dayOfWeek = row[dayOfWeekCol];
    const audience = row[audienceCol];

    if (active !== true) {
      continue;
    }

    if (!valueMatchesList(audience, category)) {
      continue;
    }

    const dayNumber = dayNameToNumber(dayOfWeek);

    if (dayNumber !== null) {
      daySet[dayNumber] = true;
    }
  }

  return Object.keys(daySet).map(function(key) {
    return Number(key);
  });
}


/**
 * calculateMissedTrainingDaysFast(...)
 *
 * Считает missedTrainingDays без чтения таблиц.
 *
 * previousAttendanceDate берётся из Checkin_State.
 * scheduleDays уже заранее получен из Training_Schedule.
 */
function calculateMissedTrainingDaysFast(
  previousAttendanceDate,
  scheduleDays,
  nowDate
) {

  if (!previousAttendanceDate) {
    return 0;
  }

  if (!scheduleDays || scheduleDays.length === 0) {
    return 0;
  }

  let missedDays = 0;

  let cursor = addDays(dateOnly(new Date(previousAttendanceDate)), 1);
  const yesterday = addDays(dateOnly(nowDate), -1);

  while (cursor.getTime() <= yesterday.getTime()) {

    const dayNumber = cursor.getDay();

    if (scheduleDays.indexOf(dayNumber) !== -1) {
      missedDays++;
    }

    cursor = addDays(cursor, 1);
  }

  return missedDays;
}





/**
 * ensureAttendanceHeaderOrder(attendanceSheet)
 *
 * Stellt sicher, dass Attendance die richtige Reihenfolge hat.
 * Alte Daten werden über die Headernamen korrekt übernommen.
 */
function ensureAttendanceHeaderOrder(attendanceSheet) {

  const desiredHeaders = [
    "Timestamp",
    "MemberID",
    "Vorname",
    "Nachname",
    "TrainingType",
    "TrainingName",
    "TrainingStart",
    "ContentID",
    "MessageSource",
    "MissedTrainingDays",
    "MessageCycleStatus",
    "SeenSuitableMessages"
  ];

  const lastRow = attendanceSheet.getLastRow();
  const lastCol = Math.max(attendanceSheet.getLastColumn(), desiredHeaders.length);

  if (lastRow === 0) {
    attendanceSheet.getRange(1, 1, 1, desiredHeaders.length).setValues([desiredHeaders]);
    return;
  }

  const data = attendanceSheet.getRange(1, 1, Math.max(lastRow, 1), lastCol).getValues();
  const oldHeaders = data[0];

  const extraHeaders = oldHeaders.filter(function(header) {
    return header && desiredHeaders.indexOf(header) === -1;
  });

  const finalHeaders = desiredHeaders.concat(extraHeaders);
  const finalData = [finalHeaders];

  for (let r = 1; r < data.length; r++) {

    const oldRow = data[r];
    const newRow = [];

    for (let c = 0; c < finalHeaders.length; c++) {
      const header = finalHeaders[c];
      const oldIndex = oldHeaders.indexOf(header);
      newRow.push(oldIndex !== -1 ? oldRow[oldIndex] : "");
    }

    finalData.push(newRow);
  }

  attendanceSheet.clearContents();
  attendanceSheet
    .getRange(1, 1, finalData.length, finalHeaders.length)
    .setValues(finalData);
}


/**
 * writeAttendanceRowByHeaders(attendanceSheet, rowNumber, valuesByHeader)
 *
 * Schreibt Attendance nach Headernamen, nicht nach festen Spaltenbuchstaben.
 */
function writeAttendanceRowByHeaders(attendanceSheet, rowNumber, valuesByHeader) {

  const headerMap = getHeaderMap(attendanceSheet);
  const rowValues = attendanceSheet
    .getRange(rowNumber, 1, 1, attendanceSheet.getLastColumn())
    .getValues()[0];

  Object.keys(valuesByHeader).forEach(function(header) {
    const col = headerMap[header];

    if (col) {
      rowValues[col - 1] = valuesByHeader[header];
    }
  });

  attendanceSheet
    .getRange(rowNumber, 1, 1, rowValues.length)
    .setValues([rowValues]);
}


/**
 * getHeaderMap(sheet)
 *
 * Gibt Headername → Spaltennummer zurück.
 */
function getHeaderMap(sheet) {

  const lastCol = sheet.getLastColumn();

  if (lastCol === 0) {
    return {};
  }

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const map = {};

  for (let i = 0; i < headers.length; i++) {
    if (headers[i]) {
      map[String(headers[i]).trim()] = i + 1;
    }
  }

  return map;
}


/**
 * columnToLetter(column)
 *
 * 12 → L
 */
function columnToLetter(column) {

  let temp = "";
  let letter = "";

  while (column > 0) {
    temp = (column - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    column = (column - temp - 1) / 26;
  }

  return letter;
}
/**
 * setupFastCheckinSystem()
 *
 * Запусти вручную ОДИН РАЗ после вставки нового кода.
 *
 * Что делает:
 * 1. Ставит заголовок Attendance!G1 = MissedTrainingDays.
 * 2. Создаёт/перестраивает Checkin_State из Attendance.
 * 3. Очищает cache.
 */
function setupFastCheckinSystem() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const attendanceSheet = ss.getSheetByName("Attendance");

  if (!attendanceSheet) {
    throw new Error("Attendance sheet not found.");
  }

  // Bringt Attendance in die neue sichere Reihenfolge:
  // Timestamp | MemberID | Vorname | Nachname | TrainingType | TrainingName | TrainingStart |
  // ContentID | MessageSource | MissedTrainingDays | MessageCycleStatus | SeenSuitableMessages
  ensureAttendanceHeaderOrder(attendanceSheet);

  // Перестраиваем быстрый state для последнего посещения.
  rebuildCheckinStateFromAttendance();

  // Создаём служебный state для ротации сообщений.
  getOrCreateCheckinMessageStateSheet(ss);

  // Ставим условное форматирование на SeenSuitableMessages.
  setupSeenSuitableMessagesConditionalFormatting(attendanceSheet);

  clearFastCheckinCache();

  Logger.log("Fast check-in setup completed.");
}


/**
 * setupSeenSuitableMessagesConditionalFormatting(attendanceSheet)
 *
 * Красит колонку I = SeenSuitableMessages в красный,
 * если ученику осталось 5 или меньше новых сообщений.
 *
 * Пример:
 * 7/12 → осталось 5 → красный
 * 8/12 → осталось 4 → красный
 * 12/12 → всё увидел → красный
 */
function setupSeenSuitableMessagesConditionalFormatting(attendanceSheet) {

  const headerMap = getHeaderMap(attendanceSheet);
  const seenCol = headerMap.SeenSuitableMessages;

  if (!seenCol) {
    return;
  }

  const maxRows = Math.max(attendanceSheet.getMaxRows() - 1, 1);
  const targetRange = attendanceSheet.getRange(2, seenCol, maxRows, 1);
  const a1 = targetRange.getA1Notation();
  const colLetter = columnToLetter(seenCol);

  const existingRules = attendanceSheet.getConditionalFormatRules();

  const keptRules = existingRules.filter(function(rule) {

    const ranges = rule.getRanges();

    for (let i = 0; i < ranges.length; i++) {
      if (ranges[i].getA1Notation() === a1) {
        return false;
      }
    }

    return true;
  });

  const formula = '=IFERROR(INDEX(SPLIT($' + colLetter + '2;"/");1;2)-INDEX(SPLIT($' + colLetter + '2;"/");1;1)<=5;FALSE)';

  const rule = SpreadsheetApp
    .newConditionalFormatRule()
    .whenFormulaSatisfied(formula)
    .setBackground("#F4CCCC")
    .setFontColor("#990000")
    .setRanges([targetRange])
    .build();

  keptRules.push(rule);

  attendanceSheet.setConditionalFormatRules(keptRules);
}


/**
 * rebuildCheckinStateFromAttendance()
 *
 * Эту функцию можно запустить вручную.
 *
 * Она создаёт Checkin_State из уже существующего Attendance.
 *
 * После этого scanner больше не должен каждый раз искать
 * последнее посещение ученика по всему большому Attendance.
 */
function rebuildCheckinStateFromAttendance() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const attendanceSheet = ss.getSheetByName("Attendance");
  const stateSheet = getOrCreateCheckinStateSheet(ss);

  if (!attendanceSheet) {
    throw new Error("Attendance sheet not found.");
  }

  const attendanceData = attendanceSheet.getDataRange().getValues();

  const latestByMember = {};

  if (attendanceData.length >= 2) {

    const headers = attendanceData[0];

    const timestampCol = headers.indexOf("Timestamp");
    const memberIdCol = headers.indexOf("MemberID");
    const trainingTypeCol = headers.indexOf("TrainingType");
    const trainingNameCol = headers.indexOf("TrainingName");
    const trainingStartCol = headers.indexOf("TrainingStart");

    for (let i = 1; i < attendanceData.length; i++) {

      const row = attendanceData[i];

      const timestamp = timestampCol !== -1 ? row[timestampCol] : row[0];
      const memberId = memberIdCol !== -1 ? row[memberIdCol] : row[1];

      if (!timestamp || !memberId) {
        continue;
      }

      const date = new Date(timestamp);

      if (isNaN(date.getTime())) {
        continue;
      }

      const trainingType = trainingTypeCol !== -1 ? row[trainingTypeCol] : "";
      const trainingName = trainingNameCol !== -1 ? row[trainingNameCol] : "";
      const trainingStart = trainingStartCol !== -1 ? row[trainingStartCol] : "";

      const existing = latestByMember[memberId];

      if (
        !existing ||
        date.getTime() > existing.date.getTime()
      ) {
        latestByMember[memberId] = {
          date: date,
          attendanceRowNumber: i + 1,
          trainingType: trainingType,
          trainingName: trainingName,
          trainingStart: trainingStart,
          trainingKey: trainingType && trainingStart
            ? buildTrainingKey(date, trainingType, trainingStart)
            : ""
        };
      }
    }
  }

  stateSheet.clearContents();

  const rows = [[
    "MemberID",
    "LastCheckin",
    "LastAttendanceRow",
    "LastTrainingType",
    "LastTrainingName",
    "LastTrainingStart",
    "LastTrainingKey"
  ]];

  const memberIds = Object.keys(latestByMember).sort();

  for (let i = 0; i < memberIds.length; i++) {

    const memberId = memberIds[i];
    const item = latestByMember[memberId];

    rows.push([
      memberId,
      item.date,
      item.attendanceRowNumber,
      item.trainingType,
      item.trainingName,
      item.trainingStart,
      item.trainingKey
    ]);
  }

  stateSheet
    .getRange(1, 1, rows.length, 7)
    .setValues(rows);

  Logger.log("Checkin_State rebuilt. Members: " + memberIds.length);
}









/**
 * getCheckinSmartMessage(memberId, attendanceResult, currentTraining)
 *
 * Выбирает сообщение для check-in экрана.
 *
 * Приоритет:
 * 1. Personal_Checkin
 * 2. Comeback-сообщение, если ученик пропустил тренировочные дни
 * 3. Обычное сообщение из Checkin_Content
 *
 * Возвращает:
 * {
 *   message: "...",
 *   contentId: "C012",
 *   source: "content",
 *   missedTrainingDays: 2
 * }
 */
function getCheckinSmartMessage(memberId, attendanceResult, currentTraining) {

  // Для duplicate / not_found умные сообщения не выбираем
  if (attendanceResult !== "success") {
    return {
      message: "",
      contentId: "",
      source: "",
      missedTrainingDays: 0
    };
  }

  // Сначала считаем пропущенные тренировочные дни
  const missedTrainingDays = getMissedTrainingDays(memberId);

  // 1. Сначала проверяем персональное сообщение
  const personal = getPersonalCheckinMessage(memberId);

  if (personal && personal.message) {
    personal.missedTrainingDays = missedTrainingDays;
    return personal;
  }

  // 2. Если персонального сообщения нет — берём сообщение из Checkin_Content
  const content = getRandomCheckinContent(
    memberId,
    missedTrainingDays,
    currentTraining
  );

  content.missedTrainingDays = missedTrainingDays;

  return content;
}










/**
 * getPersonalCheckinMessage(memberId)
 *
 * Ищет персональное сообщение для конкретного ученика.
 *
 * Лист: Personal_Checkin
 *
 * Колонки:
 * Active | MemberID | Message | ShowOnce | UsedAt | Note
 */
function getPersonalCheckinMessage(memberId) {

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Personal_Checkin");

  if (!sheet) {
    return null;
  }

  const data = sheet.getDataRange().getValues();

  if (data.length < 2) {
    return null;
  }

  const headers = data[0];

  const activeCol = headers.indexOf("Active");
  const memberIdCol = headers.indexOf("MemberID");
  const messageCol = headers.indexOf("Message");
  const showOnceCol = headers.indexOf("ShowOnce");
  const usedAtCol = headers.indexOf("UsedAt");

  for (let i = 1; i < data.length; i++) {

    const row = data[i];

    const active = row[activeCol];
    const rowMemberId = row[memberIdCol];
    const message = row[messageCol];
    const showOnce = row[showOnceCol];

    if (
      active === true &&
      rowMemberId == memberId &&
      message
    ) {

      // Если ShowOnce = TRUE, после показа выключаем сообщение
      if (showOnce === true) {
        sheet.getRange(i + 1, activeCol + 1).setValue(false);

        if (usedAtCol !== -1) {
          sheet.getRange(i + 1, usedAtCol + 1).setValue(new Date());
        }
      }

      return {
        message: message,
        contentId: "PERSONAL",
        source: "personal",
        contentKind: "personal"
      };
    }
  }

  return null;
}












/**
 * getRandomCheckinContent(memberId, missedTrainingDays, currentTraining)
 *
 * Выбирает подходящее сообщение из Checkin_Content.
 *
 * Учитывает:
 * - Active
 * - Category
 * - AgeMin / AgeMax
 * - TrainingType
 * - MissedMin / MissedMax
 * - Weight
 *
 * Логика:
 * Если missedTrainingDays > 0,
 * сначала ищем comeback-сообщение.
 *
 * Если comeback не найден —
 * берём обычное сообщение.
 */
function getRandomCheckinContent(memberId, missedTrainingDays, currentTraining) {

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const contentSheet = ss.getSheetByName("Checkin_Content");

  if (!contentSheet) {
    return {
      message: "",
      contentId: "",
      source: ""
    };
  }

  const memberProfile = getMemberProfileForCheckin(memberId);
  const data = contentSheet.getDataRange().getValues();

  if (data.length < 2) {
    return {
      message: "",
      contentId: "",
      source: ""
    };
  }

  const headers = data[0];

  // Если ученик пропустил тренировочные дни,
  // сначала ищем comeback-сообщение
  if (missedTrainingDays >= 5) {

    const comebackCandidates = buildCheckinContentCandidates(
      data,
      headers,
      memberProfile,
      currentTraining,
      true,
      missedTrainingDays
    );

    if (comebackCandidates.length > 0) {
      return pickWeightedRandom(comebackCandidates);
    }
  }

  // Если comeback не нужен или не найден,
  // берём обычное сообщение
  const normalCandidates = buildCheckinContentCandidates(
    data,
    headers,
    memberProfile,
    currentTraining,
    false,
    missedTrainingDays
  );

  if (normalCandidates.length === 0) {
    return {
      message: "",
      contentId: "",
      source: ""
    };
  }

  return pickWeightedRandom(normalCandidates);
}










/**
 * buildCheckinContentCandidates(...)
 *
 * Собирает список сообщений,
 * которые подходят конкретному ученику.
 *
 * requireComeback = true:
 * берём только строки, где заполнены MissedMin / MissedMax.
 *
 * requireComeback = false:
 * берём только обычные строки без MissedMin / MissedMax.
 */
/**
 * normalizeContentKind(value)
 *
 * Vereinheitlicht ContentKind aus Checkin_Content.
 * Beispiel: "coach tip" / "coach-tip" -> "coach_tip".
 */
function normalizeContentKind(value) {

  const clean = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");

  if (!clean) {
    return "";
  }

  if (clean === "coach_tip" || clean === "coachtip" || clean === "coach") {
    return "coach_tip";
  }

  if (clean === "ibjjf_rule" || clean === "ibjjf" || clean === "gi_rule" || clean === "bjj_rule") {
    return "ibjjf_rule";
  }

  if (clean === "adcc_rule" || clean === "adcc" || clean === "nogi_rule" || clean === "no_gi_rule" || clean === "grappling_rule") {
    return "adcc_rule";
  }

  if (clean === "kids_tip" || clean === "kid_tip" || clean === "kinder_tip" || clean === "children_tip") {
    return "kids_tip";
  }

  if (clean === "wrestling_tip" || clean === "wrestling" || clean === "ringer_tip") {
    return "wrestling_tip";
  }

  if (clean === "comeback") {
    return "comeback";
  }

  return clean;
}









function findHeaderIndex(headers, headerName) {

  const target = String(headerName || "").trim().toLowerCase();

  for (let i = 0; i < headers.length; i++) {
    const current = String(headers[i] || "").trim().toLowerCase();

    if (current === target) {
      return i;
    }
  }

  return -1;
}









/**
 * getAllowedContentTrainingTypes(currentTraining, memberProfile)
 *
 * Erlaubte Content-TrainingTypes für die aktuelle Trainingseinheit.
 *
 * Wichtig:
 * - BJJSparring sieht auch BJJ-Content.
 * - GrapplingSparring sieht auch Grappling-Content.
 * - Erwachsene Trainings sehen zusätzlich all.
 * - Kinder sehen NICHT all, sondern nur Kinder.
 */
function getAllowedContentTrainingTypes(currentTraining, memberProfile) {

  const currentType = currentTraining && currentTraining.trainingType
    ? String(currentTraining.trainingType).trim()
    : "";

  const memberCategory = memberProfile && memberProfile.category
    ? String(memberProfile.category).trim()
    : "";

  if (memberCategory === "Kinder" || currentType === "Kinder") {
    return ["Kinder"];
  }

  if (currentType === "BJJSparring") {
    return ["BJJSparring", "BJJ", "all"];
  }

  if (currentType === "GrapplingSparring") {
    return ["GrapplingSparring", "Grappling", "all"];
  }

  if (currentType) {
    return [currentType, "all"];
  }

  return ["all"];
}


/**
 * trainingTypeMatchesContent(contentTrainingType, currentTraining, memberProfile)
 *
 * Prüft, ob eine Content-Zeile zur aktuellen Trainingseinheit passt.
 *
 * Unterstützt:
 * - all
 * - BJJ
 * - BJJSparring
 * - Grappling
 * - GrapplingSparring
 * - Wrestling
 * - Kinder
 * - Komma-Listen wie "BJJ,BJJSparring"
 */
function trainingTypeMatchesContent(contentTrainingType, currentTraining, memberProfile) {

  const allowedTypes = getAllowedContentTrainingTypes(currentTraining, memberProfile);
  const allowedSet = buildSetFromArray(allowedTypes);

  if (!contentTrainingType) {
    return allowedSet["all"] === true;
  }

  const items = String(contentTrainingType)
    .split(",")
    .map(function(item) {
      return item.trim();
    })
    .filter(function(item) {
      return item !== "";
    });

  if (items.length === 0) {
    return allowedSet["all"] === true;
  }

  for (let i = 0; i < items.length; i++) {

    const item = items[i];

    // Für Kinder ist TrainingType=all absichtlich NICHT erlaubt.
    // Kinder sollen nur Kinder-Content bekommen.
    if (item === "all") {
      if (allowedSet["all"] === true) {
        return true;
      }

      continue;
    }

    if (allowedSet[item] === true) {
      return true;
    }
  }

  return false;
}


/**
 * getMessageHeaderForContentKind(vorname, source, contentKind)
 *
 * Bestimmt den kurzen Vorspann auf dem Scanner.
 */
function getMessageHeaderForContentKind(vorname, source, contentKind) {

  const kind = normalizeContentKind(contentKind);

  if (source === "personal" || kind === "personal") {
    return "";
  }

  if (kind === "comeback") {
    return "";
  }

  if (kind === "ibjjf_rule") {
    return "IBJJF-Regel für heute:";
  }

  if (kind === "adcc_rule") {
    return "ADCC-Regel für heute:";
  }

  if (kind === "wrestling_tip") {
    return "Wrestling-Fokus für heute:";
  }

  if (kind === "kids_tip") {
    return "Heute für dich:";
  }

  if (kind === "coach_tip") {
    if (vorname) {
      return "Hey " + vorname;
    }

    return "";
  }

  // Fallback für alte Content-Zeilen ohne ContentKind.
  if (vorname) {
    return "Hey " + vorname;
  }

  return "";
}


function buildCheckinContentCandidates(
  data,
  headers,
  memberProfile,
  currentTraining,
  requireComeback,
  missedTrainingDays
) {

  const activeCol = headers.indexOf("Active");
  const contentIdCol = headers.indexOf("ContentID");
  const ruleTypeCol = headers.indexOf("RuleType");
  const categoryCol = headers.indexOf("Category");
  const ageMinCol = headers.indexOf("AgeMin");
  const ageMaxCol = headers.indexOf("AgeMax");
  const trainingTypeCol = headers.indexOf("TrainingType");
  const missedMinCol = headers.indexOf("MissedMin");
  const missedMaxCol = headers.indexOf("MissedMax");
  const messageCol = headers.indexOf("Message");
  const weightCol = headers.indexOf("Weight");
  const contentKindCol = findHeaderIndex(headers, "ContentKind");

  const candidates = [];

  for (let i = 1; i < data.length; i++) {

    const row = data[i];

    const active = row[activeCol];
    const contentId = row[contentIdCol];
    const ruleType = ruleTypeCol !== -1 ? row[ruleTypeCol] : "";
    const category = row[categoryCol];
    const ageMin = row[ageMinCol];
    const ageMax = row[ageMaxCol];
    const trainingType = row[trainingTypeCol];
    const missedMin = row[missedMinCol];
    const missedMax = row[missedMaxCol];
    const message = row[messageCol];
    const weight = Number(row[weightCol]) || 1;

     let contentKind = contentKindCol !== -1
      ? normalizeContentKind(row[contentKindCol])
      : "";

    // Falls ContentKind fehlt oder nicht sauber gelesen wird,
    // leiten wir ihn sicher aus RuleType / TrainingType ab.
    if (!contentKind) {

      const cleanRuleType = String(ruleType || "").trim();
      const cleanTrainingType = String(trainingType || "").trim();

      if (requireComeback || cleanRuleType === "comeback") {
        contentKind = "comeback";
      } else if (cleanTrainingType === "Wrestling") {
        contentKind = "wrestling_tip";
      } else if (cleanTrainingType === "Kinder") {
        contentKind = "kids_tip";
      } else {
        contentKind = "coach_tip";
      }
    }

    // Выключенные сообщения пропускаем
    if (active !== true) {
      continue;
    }

    // Пустые сообщения пропускаем
    if (!message) {
      continue;
    }

    const hasMissedRule = missedMin !== "" || missedMax !== "";

    // Для comeback нужны только строки с MissedMin / MissedMax
    if (requireComeback && !hasMissedRule) {
      continue;
    }

    // Для обычных сообщений пропускаем comeback-строки
    if (!requireComeback && hasMissedRule) {
      continue;
    }

    // Проверяем диапазон пропущенных тренировочных дней
    if (requireComeback) {

      if (missedMin !== "" && missedTrainingDays < Number(missedMin)) {
        continue;
      }

      if (missedMax !== "" && missedTrainingDays > Number(missedMax)) {
        continue;
      }
    }

    // Проверяем Category.
    // Category entscheidet Kinder / Erwachsene / Student.
    if (!valueMatchesList(category, memberProfile.category)) {
      continue;
    }

    // Проверяем возраст, если AgeMin / AgeMax заполнены
    if (ageMin !== "" || ageMax !== "") {

      // Если возраст неизвестен,
      // age-specific сообщение лучше не показывать
      if (memberProfile.age === null) {
        continue;
      }

      if (ageMin !== "" && memberProfile.age < Number(ageMin)) {
        continue;
      }

      if (ageMax !== "" && memberProfile.age > Number(ageMax)) {
        continue;
      }
    }

      // Spezialregel für Wrestling:
    // Beim Wrestling sollen KEINE allgemeinen TrainingType=all Nachrichten kommen.
    // Erlaubt sind nur normale Content-Zeilen mit TrainingType = Wrestling.
    // Comeback bleibt erlaubt.
    if (
      !requireComeback &&
      currentTraining &&
      String(currentTraining.trainingType).trim() === "Wrestling" &&
      String(trainingType).trim() !== "Wrestling"
    ) {
      continue;
    }

    // Проверяем TrainingType mit Gruppenlogik:
    // BJJSparring -> BJJSparring + BJJ + all
    // GrapplingSparring -> GrapplingSparring + Grappling + all
    // Wrestling -> nur wrestling_tip
    // Kinder -> nur Kinder
    if (!trainingTypeMatchesContent(trainingType, currentTraining, memberProfile)) {
      continue;
    }

    // Weight:
    // сообщение с Weight 3 добавляется 3 раза,
    // поэтому выпадает чаще.
    for (let w = 0; w < weight; w++) {
      candidates.push({
        message: message,
        contentId: contentId,
        source: "content",
        contentKind: contentKind
      });
    }
  }

  return candidates;
}










/**
 * pickWeightedRandom(candidates)
 *
 * Выбирает случайное сообщение из списка.
 *
 * Weight уже учтён заранее:
 * сообщение с Weight 3 лежит в списке 3 раза.
 */
function pickWeightedRandom(candidates) {

  const index = Math.floor(Math.random() * candidates.length);

  return candidates[index];
}









/**
 * valueMatchesList(listValue, targetValue)
 *
 * Проверяет, подходит ли значение к списку.
 *
 * Примеры:
 *
 * listValue = "all"
 * targetValue = "Kinder"
 * → true
 *
 * listValue = "Erwachsene,Student"
 * targetValue = "Student"
 * → true
 *
 * listValue = "Kinder"
 * targetValue = "Student"
 * → false
 */
function normalizeCategoryValue(value) {

  const clean = String(value || "")
    .trim()
    .toLowerCase();

  if (
    clean === "kinder" ||
    clean === "kind" ||
    clean === "kids" ||
    clean === "kid" ||
    clean === "children" ||
    clean === "child"
  ) {
    return "Kinder";
  }

  if (
    clean === "erwachsene" ||
    clean === "erwachsener" ||
    clean === "adult" ||
    clean === "adults"
  ) {
    return "Erwachsene";
  }

  if (
    clean === "student" ||
    clean === "students" ||
    clean === "studenten"
  ) {
    return "Student";
  }

  if (clean === "all") {
    return "all";
  }

  return String(value || "").trim();
}


function normalizeCategoryValue(value) {

  const clean = String(value || "")
    .trim()
    .toLowerCase();

  if (
    clean === "kinder" ||
    clean === "kind" ||
    clean === "kids" ||
    clean === "kid" ||
    clean === "children" ||
    clean === "child"
  ) {
    return "Kinder";
  }

  if (
    clean === "erwachsene" ||
    clean === "erwachsener" ||
    clean === "adult" ||
    clean === "adults"
  ) {
    return "Erwachsene";
  }

  if (
    clean === "student" ||
    clean === "students" ||
    clean === "studenten"
  ) {
    return "Student";
  }

  if (clean === "all") {
    return "all";
  }

  return String(value || "").trim();
}


function normalizeCategoryValue(value) {

  const clean = String(value || "")
    .trim()
    .toLowerCase();

  if (
    clean === "kinder" ||
    clean === "kind" ||
    clean === "kids" ||
    clean === "kid" ||
    clean === "children" ||
    clean === "child"
  ) {
    return "Kinder";
  }

  if (
    clean === "erwachsene" ||
    clean === "erwachsener" ||
    clean === "adult" ||
    clean === "adults"
  ) {
    return "Erwachsene";
  }

  if (
    clean === "student" ||
    clean === "students" ||
    clean === "studenten"
  ) {
    return "Student";
  }

  if (clean === "all") {
    return "all";
  }

  return String(value || "").trim();
}


function normalizeCategoryValue(value) {

  const clean = String(value || "")
    .trim()
    .toLowerCase();

  if (
    clean === "kinder" ||
    clean === "kind" ||
    clean === "kids" ||
    clean === "kid" ||
    clean === "children" ||
    clean === "child"
  ) {
    return "Kinder";
  }

  if (
    clean === "erwachsene" ||
    clean === "erwachsener" ||
    clean === "adult" ||
    clean === "adults"
  ) {
    return "Erwachsene";
  }

  if (
    clean === "student" ||
    clean === "students" ||
    clean === "studenten"
  ) {
    return "Student";
  }

  if (clean === "all") {
    return "all";
  }

  return String(value || "").trim();
}


function normalizeCategoryValue(value) {

  const clean = String(value || "")
    .trim()
    .toLowerCase();

  if (
    clean === "kinder" ||
    clean === "kind" ||
    clean === "kids" ||
    clean === "kid" ||
    clean === "children" ||
    clean === "child"
  ) {
    return "Kinder";
  }

  if (
    clean === "erwachsene" ||
    clean === "erwachsener" ||
    clean === "adult" ||
    clean === "adults"
  ) {
    return "Erwachsene";
  }

  if (
    clean === "student" ||
    clean === "students" ||
    clean === "studenten"
  ) {
    return "Student";
  }

  if (clean === "all") {
    return "all";
  }

  return String(value || "").trim();
}


function valueMatchesList(listValue, targetValue) {

  if (!listValue) {
    return true;
  }

  const normalizedTarget = normalizeCategoryValue(targetValue);

  if (normalizeCategoryValue(listValue) === "all") {
    return true;
  }

  if (!normalizedTarget) {
    return false;
  }

  const items = String(listValue)
    .split(",")
    .map(function(item) {
      return normalizeCategoryValue(item);
    });

  return items.indexOf(normalizedTarget) !== -1;
}








/**
 * getMissedTrainingDays(memberId)
 *
 * Считает, сколько тренировочных дней ученик пропустил
 * с момента своего предыдущего посещения.
 *
 * Важно:
 * Считаем именно дни, а не количество тренировок.
 *
 * Пример:
 * В понедельник у взрослых 2 тренировки.
 * Если взрослый не пришёл в понедельник,
 * это считается как 1 пропущенный тренировочный день.
 *
 * Использует:
 * - Mitglieder → чтобы узнать Kategorie ученика
 * - Attendance → чтобы найти прошлое посещение
 * - Training_Schedule → чтобы узнать, какие дни подходят этой категории
 */
function getMissedTrainingDays(memberId) {

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const attendanceSheet = ss.getSheetByName("Attendance");
  const scheduleSheet = ss.getSheetByName("Training_Schedule");

  const memberProfile = getMemberProfileForCheckin(memberId);

  if (!attendanceSheet || !scheduleSheet || !memberProfile.category) {
    return 0;
  }

  const attendanceData = attendanceSheet.getDataRange().getValues();

  const now = new Date();
  const nowMs = now.getTime();

  let previousAttendanceDate = null;

  /**
   * Ищем предыдущее посещение.
   *
   * Текущий check-in уже записан в Attendance,
   * поэтому последняя строка ученика может быть "сейчас".
   *
   * Мы пропускаем запись, если она моложе 10 минут.
   * Так мы находим именно прошлое посещение.
   */
  for (let i = attendanceData.length - 1; i >= 1; i--) {

    const rowTimestamp = attendanceData[i][0];
    const rowMemberId = attendanceData[i][1];

    if (rowMemberId != memberId) {
      continue;
    }

    const checkinDate = new Date(rowTimestamp);
    const diffMs = nowMs - checkinDate.getTime();

    // Пропускаем текущий check-in
    if (diffMs < 10 * 60 * 1000) {
      continue;
    }

    previousAttendanceDate = checkinDate;
    break;
  }

  // Если прошлой записи нет — это первый check-in.
  // Не считаем это как пропуск.
  if (!previousAttendanceDate) {
    return 0;
  }

  const scheduleDays = getTrainingDaysForCategory(memberProfile.category);

  if (scheduleDays.length === 0) {
    return 0;
  }

  let missedDays = 0;

  /**
   * Считаем с дня после последнего посещения
   * до вчерашнего дня.
   *
   * Сегодня не считаем как пропуск,
   * потому что человек сейчас пришёл.
   */
  let cursor = addDays(dateOnly(previousAttendanceDate), 1);
  const yesterday = addDays(dateOnly(now), -1);

  while (cursor.getTime() <= yesterday.getTime()) {

    const dayNumber = cursor.getDay();

    if (scheduleDays.indexOf(dayNumber) !== -1) {
      missedDays++;
    }

    cursor = addDays(cursor, 1);
  }

  return missedDays;
}







/**
 * getTrainingDaysForCategory(category)
 *
 * Возвращает список дней недели,
 * в которые у этой категории есть тренировки.
 *
 * Важно:
 * Если в один день несколько тренировок,
 * день всё равно считается один раз.
 *
 * Возвращает числа:
 * Sunday = 0
 * Monday = 1
 * Tuesday = 2
 * Wednesday = 3
 * Thursday = 4
 * Friday = 5
 * Saturday = 6
 */
function getTrainingDaysForCategory(category) {

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Training_Schedule");

  if (!sheet) {
    return [];
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const activeCol = headers.indexOf("Active");
  const dayOfWeekCol = headers.indexOf("DayOfWeek");
  const audienceCol = headers.indexOf("Audience");

  const daySet = {};

  for (let i = 1; i < data.length; i++) {

    const row = data[i];

    const active = row[activeCol];
    const dayOfWeek = row[dayOfWeekCol];
    const audience = row[audienceCol];

    if (active !== true) {
      continue;
    }

    // Audience в Training_Schedule должен совпадать с Kategorie ученика.
    // Например:
    // Kinder
    // Erwachsene,Student
    if (!valueMatchesList(audience, category)) {
      continue;
    }

    const dayNumber = dayNameToNumber(dayOfWeek);

    if (dayNumber !== null) {
      daySet[dayNumber] = true;
    }
  }

  return Object.keys(daySet).map(function(key) {
    return Number(key);
  });
}


/**
 * dayNameToNumber(dayName)
 *
 * Превращает название дня недели в число.
 *
 * Поддерживает английские и немецкие названия.
 */
function dayNameToNumber(dayName) {

  const value = String(dayName).trim().toLowerCase();

  const map = {
    "sunday": 0,
    "sonntag": 0,

    "monday": 1,
    "montag": 1,

    "tuesday": 2,
    "dienstag": 2,

    "wednesday": 3,
    "mittwoch": 3,

    "thursday": 4,
    "donnerstag": 4,

    "friday": 5,
    "freitag": 5,

    "saturday": 6,
    "samstag": 6
  };

  if (map.hasOwnProperty(value)) {
    return map[value];
  }

  return null;
}


/**
 * dateOnly(date)
 *
 * Убирает время из даты.
 * Оставляет только год, месяц, день.
 */
function dateOnly(date) {

  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
}


/**
 * addDays(date, days)
 *
 * Добавляет к дате нужное количество дней.
 */
function addDays(date, days) {

  const result = new Date(date);
  result.setDate(result.getDate() + days);

  return result;
}







/**
 * getMemberProfileForCheckin(memberId)
 *
 * Берёт данные ученика из Mitglieder:
 * - Kategorie
 * - возраст, если есть дата рождения
 */
function getMemberProfileForCheckin(memberId) {

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Mitglieder");

  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const memberIdCol = headers.indexOf("MemberID");
  const categoryCol = headers.indexOf("Kategorie");

  // Возможные названия колонки с датой рождения
  let birthCol = headers.indexOf("Geburtsdatum");

  if (birthCol === -1) {
    birthCol = headers.indexOf("Geburtstag");
  }

  if (birthCol === -1) {
    birthCol = headers.indexOf("Geburt");
  }

  for (let i = 1; i < data.length; i++) {

    const row = data[i];

    if (row[memberIdCol] == memberId) {

      const category = categoryCol !== -1
        ? row[categoryCol]
        : "";

      let age = null;

      if (birthCol !== -1 && row[birthCol]) {
        age = calculateAge(row[birthCol]);
      }

      return {
        category: category,
        age: age
      };
    }
  }

  return {
    category: "",
    age: null
  };
}









/**
 * calculateAge(birthDate)
 *
 * Считает возраст по дате рождения.
 */
function calculateAge(birthDate) {

  const today = new Date();
  const date = new Date(birthDate);

  let age = today.getFullYear() - date.getFullYear();

  const monthDiff = today.getMonth() - date.getMonth();

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < date.getDate())
  ) {
    age--;
  }

  return age;
}







/**
 * formatCheckinMessage(vorname, message)
 *
 * Делает сообщение более персональным.
 *
 * В таблице мы храним сообщение без имени:
 * "Heute im Sparring ruhig bleiben."
 *
 * На экране система показывает:
 * "Hey Amin, Heute im Sparring ruhig bleiben."
 *
 * Если имени нет — возвращает просто сообщение.
 * Если сообщения нет — возвращает пустую строку.
 */
function formatCheckinMessage(vorname, message, source, contentKind) {

  // Если сообщение пустое — ничего не показываем
  if (!message) {
    return "";
  }

  const header = getMessageHeaderForContentKind(
    vorname,
    source,
    contentKind
  );

  if (!header) {
    return message;
  }

  return header + "\n" + message;
}








/**
 * saveShownMessageToAttendance(memberId, smartMessage)
 *
 * Сохраняет в последнюю запись Attendance информацию о том,
 * какое check-in сообщение было показано ученику.
 *
 * Лист Attendance теперь имеет колонки:
 * A = Timestamp
 * B = MemberID
 * C = Vorname
 * D = Nachname
 * E = ContentID
 * F = MessageSource
 *
 * Пример:
 * ContentID     = C012 или PERSONAL
 * MessageSource = content или personal
 *
 * Мы НЕ сохраняем сам текст сообщения в Attendance,
 * потому что текст уже хранится в Checkin_Content или Personal_Checkin.
 */
function saveShownMessageToAttendance(memberId, smartMessage) {

  // Если сообщения нет — ничего не записываем
  if (!smartMessage || !smartMessage.contentId) {
    return;
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const attendanceSheet = ss.getSheetByName("Attendance");

  const data = attendanceSheet.getDataRange().getValues();

  // Идём снизу вверх и ищем последнюю запись этого ученика
  for (let i = data.length - 1; i >= 1; i--) {

    const rowMemberId = data[i][1]; // B = MemberID

    if (rowMemberId == memberId) {

      // E = ContentID
      attendanceSheet.getRange(i + 1, 5).setValue(smartMessage.contentId);

      // F = MessageSource
      attendanceSheet.getRange(i + 1, 6).setValue(smartMessage.source);

      return;
    }
  }
}









/**
 * getCurrentTraining()
 *
 * Определяет, какая тренировка идёт прямо сейчас.
 *
 * Использует лист:
 * Training_Schedule
 *
 * Колонки:
 * Active
 * TrainingType
 * DisplayName
 * DayOfWeek
 * StartTime
 * EndTime
 * Audience
 * Note
 *
 * Возвращает объект:
 * {
 *   trainingType: "BJJ",
 *   displayName: "Gi Training",
 *   audience: "adult"
 * }
 *
 * Если сейчас нет тренировки — возвращает пустые значения.
 */
function getCurrentTraining() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Training_Schedule");

  // Если листа нет — просто возвращаем пустой результат
  if (!sheet) {
    return {
      trainingType: "",
      displayName: "",
      audience: ""
    };
  }

  const data = sheet.getDataRange().getValues();

  // Если в листе только заголовки или он пустой
  if (data.length < 2) {
    return {
      trainingType: "",
      displayName: "",
      audience: ""
    };
  }

  const headers = data[0];

  const activeCol = headers.indexOf("Active");
  const trainingTypeCol = headers.indexOf("TrainingType");
  const displayNameCol = headers.indexOf("DisplayName");
  const dayOfWeekCol = headers.indexOf("DayOfWeek");
  const startTimeCol = headers.indexOf("StartTime");
  const endTimeCol = headers.indexOf("EndTime");
  const audienceCol = headers.indexOf("Audience");

  const now = new Date();

  // Получаем текущий день недели на английском,
  // чтобы сравнивать с Monday / Tuesday / Wednesday ...
  const currentDay = Utilities.formatDate(
    now,
    Session.getScriptTimeZone(),
    "EEEE"
  );

  // Текущее время в минутах от начала дня
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  for (let i = 1; i < data.length; i++) {

    const row = data[i];

    const active = row[activeCol];
    const trainingType = row[trainingTypeCol];
    const displayName = row[displayNameCol];
    const dayOfWeek = row[dayOfWeekCol];
    const startTime = row[startTimeCol];
    const endTime = row[endTimeCol];
    const audience = row[audienceCol];

    // Пропускаем выключенные строки
    if (active !== true) {
      continue;
    }

    // Пропускаем другой день недели
    if (dayOfWeek !== currentDay) {
      continue;
    }

    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);

    // Проверяем, попадает ли текущее время в интервал тренировки
    if (
      currentMinutes >= startMinutes &&
      currentMinutes <= endMinutes
    ) {
      return {
        trainingType: trainingType,
        displayName: displayName,
        audience: audience
      };
    }
  }

  // Сейчас нет активной тренировки по расписанию
  return {
    trainingType: "",
    displayName: "",
    audience: ""
  };
}








/**
 * timeToMinutes(timeValue)
 *
 * Превращает время из Google Sheets в минуты от начала дня.
 *
 * Поддерживает два варианта:
 * 1. Время как объект Date
 * 2. Время как текст "18:00"
 */
function timeToMinutes(timeValue) {

  // Если Google Sheets отдал время как Date.
  if (timeValue instanceof Date) {
    return timeValue.getHours() * 60 + timeValue.getMinutes();
  }

  // Если Google Sheets отдал время как число.
  // Например 0.75 = 18:00.
  if (typeof timeValue === "number") {
    return Math.round(timeValue * 24 * 60);
  }

  const text = String(timeValue).trim();

  // Если время пришло как ISO date string.
  const possibleDate = new Date(text);

  if (!isNaN(possibleDate.getTime()) && text.indexOf("T") !== -1) {
    return possibleDate.getHours() * 60 + possibleDate.getMinutes();
  }

  // Если время записано как обычный текст "18:00".
  const parts = text.split(":");

  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);

  return hours * 60 + minutes;
}








/**
 * addAttendance(memberId)
 *
 * Записывает посещение ученика в лист Attendance.
 *
 * Логика:
 * 1. Проверяет последние посещения ученика.
 * 2. Если последний check-in был меньше 10 минут назад,
 *    новая запись НЕ создаётся.
 * 3. Если прошло больше 10 минут,
 *    создаётся новая запись посещения.
 * 4. Перед записью ищет ученика в листе Mitglieder.
 * 5. Сохраняет:
 *    Timestamp | MemberID | Vorname | Nachname
 *
 * Возвращает:
 *
 * success
 *   = посещение успешно записано.
 *
 * duplicate
 *   = ученик уже отметился менее 10 минут назад.
 *
 * not_found
 *   = MemberID не найден в листе Mitglieder.
 *
 * Используется:
 * - QR Check-In System
 * - GitHub Scanner
 * - doGet()
 */
function addAttendance(memberId) {

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const membersSheet = ss.getSheetByName("Mitglieder");
  const attendanceSheet = ss.getSheetByName("Attendance");

  // Берём все записи посещений
  const attendanceData = attendanceSheet.getDataRange().getValues();

  // Текущее время
  const now = new Date().getTime();

  // Проверяем последние посещения этого ученика
  for (let i = attendanceData.length - 1; i >= 0; i--) {

    // В Attendance:
    // A = Timestamp
    // B = MemberID
    if (attendanceData[i][1] == memberId) {

      const lastTime = new Date(attendanceData[i][0]).getTime();

      // Если последний check-in был меньше 10 минут назад,
      // новую запись НЕ создаём
      if (now - lastTime < 10 * 60 * 1000) {
        return "duplicate";
      }

      // Последний check-in найден, но он старше 10 минут
      break;
    }
  }

  // Берём список учеников
  const membersData = membersSheet.getDataRange().getValues();

  // Ищем ученика по MemberID
  for (let i = 1; i < membersData.length; i++) {

    const id = membersData[i][0];

    if (id == memberId) {

      const vorname = membersData[i][1];
      const nachname = membersData[i][2];

      // Записываем новое посещение
      attendanceSheet.appendRow([
        new Date(),
        memberId,
        vorname,
        nachname
      ]);

      return "success";
    }
  }

  // Если MemberID не найден в Mitglieder
  return "not_found";
}









/**
 * getMemberName(memberId)
 *
 * Возвращает только имя ученика по MemberID.
 *
 * Используется для экрана:
 * "Willkommen zum Training, Amin"
 */
function getMemberName(memberId) {

  const membersSheet = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName("Mitglieder");

  const data = membersSheet.getDataRange().getValues();

  /**
   * Ищем ученика по MemberID.
   */
  for (let i = 1; i < data.length; i++) {

    if (data[i][0] == memberId) {
      return data[i][1]; // Vorname only
    }
  }

  /**
   * Если почему-то ученика не нашли,
   * возвращаем сам MemberID.
   */
  return memberId;
}





/************************************
 * AXIS CARD GENERATOR — TEST
 * Генерирует одну карточку для AJJ001
 ************************************/

const SLIDES_TEMPLATE_ID = "1or4T8r5vWGva4uYLkddd84Fu9mqErLNsef8pOrigJBQ";






/**
 * Тест: создать одну карточку для AJJ001.
 * Сначала проверим, что шаблон, имя и QR работают правильно.
 */
function testGenerateCard_AJJ001() {
  generateMemberCard("AJJ001");
}







/**
 * generateMemberCard(memberId)
 *
 * Создаёт одну check-in карточку для конкретного ученика.
 *
 * Что делает:
 * 1. Ищет ученика в листе Mitglieder по MemberID.
 * 2. Берёт Vorname и Nachname.
 * 3. Копирует Google Slides шаблон.
 * 4. Случайно выбирает один дизайн слайда.
 * 5. Вставляет имя, фамилию и QR-код.
 * 6. Экспортирует готовую карточку как PNG.
 * 7. Сохраняет PNG в папку "AXIS Check-In Cards".
 * 8. Удаляет временную копию Google Slides.
 *
 * Важно:
 * QR-код теперь содержит только MemberID:
 * AJJ001
 *
 * Больше НЕ используется длинная ссылка:
 * WEB_APP_URL?id=AJJ001
 *
 * Это делает QR-код проще, крупнее и быстрее для сканирования.
 */
function generateMemberCard(memberId, forcedSlideIndex) {

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const membersSheet = ss.getSheetByName("Mitglieder");
  const data = membersSheet.getDataRange().getValues();

  let vorname = "";
  let nachname = "";

  // Ищем ученика по MemberID
  for (let i = 1; i < data.length; i++) {

    if (data[i][0] == memberId) {
      vorname = data[i][1];
      nachname = data[i][2];
      break;
    }
  }

  // Если ученик не найден — останавливаемся с ошибкой
  if (!vorname) {
    throw new Error("Member not found: " + memberId);
  }

  /**
   * Данные для QR-кода.
   *
   * Раньше здесь была длинная ссылка:
   * WEB_APP_URL + "?id=" + memberId
   *
   * Теперь QR содержит только:
   * AJJ001
   */
  const qrData = memberId;

  // QR-картинка с простыми данными AJJ001
  const qrImageUrl =
    "https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=" +
    encodeURIComponent(qrData);

  // Создаём или находим папку для карточек
  const folderName = "AXIS Check-In Cards";
  const folders = DriveApp.getFoldersByName(folderName);
  const folder = folders.hasNext()
    ? folders.next()
    : DriveApp.createFolder(folderName);

  // Копируем Slides шаблон
  const templateFile = DriveApp.getFileById(SLIDES_TEMPLATE_ID);
  const copyFile = templateFile.makeCopy(
    "TEMP_CARD_" + memberId,
    folder
  );

  const presentation = SlidesApp.openById(copyFile.getId());
  const slides = presentation.getSlides();

  // Случайно выбираем один слайд: 0 = чёрный, 1 = синий
  const selectedIndex = forcedSlideIndex !== undefined
  ? forcedSlideIndex
  : Math.floor(Math.random() * 2);  
  
  const selectedSlide = slides[selectedIndex];

  // Удаляем все слайды, кроме выбранного
  for (let i = slides.length - 1; i >= 0; i--) {

    if (i !== selectedIndex) {
      slides[i].remove();
    }
  }

  // После удаления остаётся один слайд
  const slide = presentation.getSlides()[0];

  // Цвет текста: белый для старых карт, чёрный для белой карты
  const textColor = selectedIndex === 2 ? "#111111" : "#FFFFFF";

  // Заменяем имя и фамилию
  replaceAndStyleText(slide, "{{VORNAME}}", vorname, 21, textColor);
  replaceAndStyleText(slide, "{{NACHNAME}}", nachname, 21, textColor);

  // Ищем placeholder {{QR}} и вставляем QR-картинку на его место
  const elements = slide.getPageElements();

  for (let i = 0; i < elements.length; i++) {

    const el = elements[i];

    if (el.getPageElementType() === SlidesApp.PageElementType.SHAPE) {

      const shape = el.asShape();

      if (shape.getText().asString().includes("{{QR}}")) {

        const left = el.getLeft();
        const top = el.getTop();
        const width = el.getWidth();
        const height = el.getHeight();

        // Удаляем служебный текст {{QR}}
        el.remove();

        // Вставляем QR-код на его место
        slide.insertImage(qrImageUrl, left, top, width, height);

        break;
      }
    }
  }

  presentation.saveAndClose();

  // Экспортируем единственный слайд как PNG
  const finalPresentation = SlidesApp.openById(copyFile.getId());
  const pageId = finalPresentation.getSlides()[0].getObjectId();

  const thumbnail = Slides.Presentations.Pages.getThumbnail(
    copyFile.getId(),
    pageId,
    {
      "thumbnailProperties.mimeType": "PNG",
      "thumbnailProperties.thumbnailSize": "LARGE"
    }
  );

  /**
   * Имя файла начинается с MemberID.
   * Так generateMissingMemberCards() понимает,
   * что карточка уже создана.
   */
  const fileName = memberId + "_" + vorname + "_" + nachname + ".png";

  const pngBlob = UrlFetchApp.fetch(thumbnail.contentUrl)
    .getBlob()
    .setName(fileName);

  folder.createFile(pngBlob);

  // Удаляем временную Slides-копию, чтобы Drive не засорялся
  copyFile.setTrashed(true);
}









/**
 * replaceAndStyleText(slide, placeholder, value, fontSize)
 *
 * Что делает эта функция:
 * 1. Ищет на слайде текстовое поле с нужным placeholder.
 *    Например: {{VORNAME}} или {{NACHNAME}}
 *
 * 2. Заменяет placeholder на реальный текст.
 *    Например: {{VORNAME}} → Amin
 *
 * 3. Сразу задаёт стиль:
 *    - белый цвет
 *    - жирный шрифт
 *    - нужный размер
 *    - Arial
 *    - выравнивание по центру
 *
 * Почему нужна отдельная функция:
 * slide.replaceAllText(...) может заменить текст,
 * но не даёт удобно задать цвет, размер и жирность.
 */
  function replaceAndStyleText(slide, placeholder, value, fontSize, textColor) {

  // Получаем все элементы на слайде:
  // картинки, текстовые поля, фигуры и т.д.
  const elements = slide.getPageElements();

  // Проходим по каждому элементу на слайде
  for (let i = 0; i < elements.length; i++) {

    const element = elements[i];

    // Нам нужны только SHAPE-элементы,
    // потому что текстовые поля в Google Slides считаются Shape.
    if (element.getPageElementType() !== SlidesApp.PageElementType.SHAPE) {
      continue;
    }

    // Превращаем элемент в Shape, чтобы получить доступ к тексту
    const shape = element.asShape();

    // Получаем текст внутри этого текстового поля
    const textRange = shape.getText();

    // Если внутри нет нужного placeholder — идём дальше
    if (!textRange.asString().includes(placeholder)) {
      continue;
    }

    // Заменяем placeholder на реальное значение
    // Например: {{NACHNAME}} → Demirov
    textRange.setText(value);

    // Задаём стиль текста
    textRange.getTextStyle()
     .setForegroundColor(textColor || "#FFFFFF") // белый цвет ili cherniy
      .setBold(true)                 // жирный текст
      .setFontSize(fontSize)         // размер текста, например 36
      .setFontFamily("Arial");       // шрифт

    // Выравниваем текст по центру внутри текстового поля
    textRange.getParagraphStyle()
      .setParagraphAlignment(SlidesApp.ParagraphAlignment.CENTER);

    // После того как нашли и обработали нужный placeholder,
    // выходим из функции.
    return;
  }
}





function generateWhiteMemberCard(memberId) {
  generateMemberCard(memberId, 2);
}


function generateOneWhiteMemberCard() {
  generateWhiteMemberCard("AJJ013");
}







/**
 * generateMissingMemberCards()
 *
 * Создаёт карточки только тем ученикам,
 * у кого ещё нет карточки в папке "AXIS Check-In Cards".
 *
 * Проверка идёт по MemberID:
 * если в папке уже есть файл, который начинается с AJJ001_,
 * значит карточка для AJJ001 уже существует.
 */
function generateMissingMemberCards() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const membersSheet = ss.getSheetByName("Mitglieder");
  const data = membersSheet.getDataRange().getValues();

  const folderName = "AXIS Check-In Cards";

  const folders = DriveApp.getFoldersByName(folderName);
  const folder = folders.hasNext()
    ? folders.next()
    : DriveApp.createFolder(folderName);

  for (let i = 1; i < data.length; i++) {

    const memberId = data[i][0];
    const vorname = data[i][1];
    const nachname = data[i][2];

    // Ищем колонку Status по названию в первой строке
    const statusCol = data[0].indexOf("Status");
    const status = statusCol !== -1 ? String(data[i][statusCol]).toLowerCase().trim() : "";

    // Если строка не полностью заполнена — пропускаем
      if (!memberId || !vorname || !nachname) {
      continue;
      }

    // Если статус НЕ aktiv — карточку не создаём
      if (status !== "aktiv") {
        continue;
      }

    // Если карточка уже есть — пропускаем
    if (memberCardExists(folder, memberId)) {
      continue;
    }

    // Если карточки нет — создаём
    generateMemberCard(memberId);
  }
}








/**
 * memberCardExists(folder, memberId)
 *
 * Проверяет, есть ли уже карточка ученика в папке.
 *
 * Пример:
 * memberId = AJJ001
 *
 * Если есть файл:
 * AJJ001_Amin_Demirov.png
 *
 * значит карточка уже создана.
 */
function memberCardExists(folder, memberId) {

  const files = folder.getFiles();

  while (files.hasNext()) {

    const file = files.next();
    const fileName = file.getName();

    if (fileName.startsWith(memberId + "_")) {
      return true;
    }
  }

  return false;
}
