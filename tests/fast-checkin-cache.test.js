const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");

class FakeCache {
  constructor() {
    this.values = new Map();
    this.ttls = new Map();
  }

  get(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  put(key, value, ttl) {
    this.values.set(key, value);
    this.ttls.set(key, ttl);
  }

  remove(key) {
    this.values.delete(key);
    this.ttls.delete(key);
  }
}

class FakeSheet {
  constructor(name, values) {
    this.name = name;
    this.values = values.map((row) => row.slice());
    this.reads = [];
    this.writes = [];
  }

  getName() {
    return this.name;
  }

  getLastRow() {
    return this.values.length;
  }

  getLastColumn() {
    return this.values.reduce((max, row) => Math.max(max, row.length), 0);
  }

  getDataRange() {
    return this.getRange(1, 1, this.getLastRow(), this.getLastColumn());
  }

  getRange(row, column, rowCount = 1, columnCount = 1) {
    const sheet = this;

    return {
      getValue() {
        return this.getValues()[0][0];
      },
      getValues() {
        sheet.reads.push({ row, column, rowCount, columnCount });
        return Array.from({ length: rowCount }, (_, rowOffset) =>
          Array.from({ length: columnCount }, (_, columnOffset) =>
            sheet.values[row - 1 + rowOffset]?.[column - 1 + columnOffset] ?? ""
          )
        );
      },
      setValues(rows) {
        sheet.writes.push({ row, column, rows: rows.map((item) => item.slice()) });

        rows.forEach((sourceRow, rowOffset) => {
          const targetIndex = row - 1 + rowOffset;
          while (sheet.values.length <= targetIndex) sheet.values.push([]);
          sourceRow.forEach((value, columnOffset) => {
            sheet.values[targetIndex][column - 1 + columnOffset] = value;
          });
        });
      },
      setValue(value) {
        this.setValues([[value]]);
      }
    };
  }
}

function loadCode() {
  const cache = new FakeCache();
  const context = {
    CacheService: {
      getScriptCache() {
        return cache;
      }
    },
    console,
    Date,
    JSON,
    Math,
    String,
    Number,
    Object,
    Array
  };

  vm.createContext(context);
  const code = fs.readFileSync(
    path.join(__dirname, "..", "apps-script", "Code.js"),
    "utf8"
  );
  vm.runInContext(code, context);

  return { context, cache };
}

test("static sheet cache lasts six hours and is cleared explicitly", () => {
  const { context, cache } = loadCode();
  const schedule = new FakeSheet("Training_Schedule", [
    ["Active", "TrainingType"],
    [true, "Gi"]
  ]);
  const ss = {
    getSheetByName(name) {
      return name === "Training_Schedule" ? schedule : null;
    }
  };

  const first = context.getSheetValuesCached(ss, "Training_Schedule", 21600);
  schedule.values[1][1] = "No-Gi";
  const cached = context.getSheetValuesCached(ss, "Training_Schedule", 21600);

  assert.equal(first[1][1], "Gi");
  assert.equal(cached[1][1], "Gi");
  assert.equal(schedule.reads.length, 1);
  assert.equal(cache.ttls.get("AXIS_FAST_Training_Schedule"), 21600);

  context.clearFastCheckinCache();
  const refreshed = context.getSheetValuesCached(ss, "Training_Schedule", 21600);

  assert.equal(refreshed[1][1], "No-Gi");
  assert.equal(schedule.reads.length, 2);
});

test("row index caches only row numbers and always reads current state values", () => {
  const { context } = loadCode();
  const state = new FakeSheet("Checkin_State", [
    ["MemberID", "LastCheckin", "LastAttendanceRow", "LastTrainingType", "LastTrainingName", "LastTrainingStart", "LastTrainingKey"],
    ["AJJ001", "old", 10, "Gi", "Gi", "18:00", "old-key"],
    ["AJJ002", "other", 11, "No-Gi", "No-Gi", "19:30", "other-key"]
  ]);

  const first = context.getCheckinStateForMemberIndexed(state, "AJJ001");
  state.values[1][1] = "new";
  state.values[1][6] = "new-key";
  const second = context.getCheckinStateForMemberIndexed(state, "AJJ001");

  assert.equal(first.lastCheckin, "old");
  assert.equal(second.lastCheckin, "new");
  assert.equal(second.lastTrainingKey, "new-key");
});

test("stale row index self-heals after sheet sorting", () => {
  const { context } = loadCode();
  const state = new FakeSheet("Checkin_State", [
    ["MemberID", "LastCheckin", "LastAttendanceRow", "LastTrainingType", "LastTrainingName", "LastTrainingStart", "LastTrainingKey"],
    ["AJJ001", "one", 10, "Gi", "Gi", "18:00", "key-one"],
    ["AJJ002", "two", 11, "No-Gi", "No-Gi", "19:30", "key-two"]
  ]);

  context.getCheckinStateForMemberIndexed(state, "AJJ001");
  [state.values[1], state.values[2]] = [state.values[2], state.values[1]];

  const healed = context.getCheckinStateForMemberIndexed(state, "AJJ001");

  assert.equal(healed.rowNumber, 3);
  assert.equal(healed.lastTrainingKey, "key-one");
});

test("attendance writer caches headers and never reads the empty target row", () => {
  const { context } = loadCode();
  const attendance = new FakeSheet("Attendance", [
    ["Timestamp", "MemberID", "Vorname", "ContentID"]
  ]);

  context.writeAttendanceRowByHeaders(attendance, 2, {
    Timestamp: "now",
    MemberID: "AJJ001",
    Vorname: "Anna",
    ContentID: "C001"
  });
  context.writeAttendanceRowByHeaders(attendance, 3, {
    Timestamp: "later",
    MemberID: "AJJ002",
    Vorname: "Ben",
    ContentID: "C002"
  });

  assert.deepEqual(attendance.values[1], ["now", "AJJ001", "Anna", "C001"]);
  assert.deepEqual(attendance.values[2], ["later", "AJJ002", "Ben", "C002"]);
  assert.deepEqual(attendance.reads, [
    { row: 1, column: 1, rowCount: 1, columnCount: 4 }
  ]);
});

test("appending a new state row invalidates the cached row index", () => {
  const { context, cache } = loadCode();
  const state = new FakeSheet("Checkin_State", [
    ["MemberID", "LastCheckin", "LastAttendanceRow", "LastTrainingType", "LastTrainingName", "LastTrainingStart", "LastTrainingKey"]
  ]);

  context.getCheckinStateForMemberIndexed(state, "AJJ003");
  assert.ok(cache.get("AXIS_FAST_ROW_INDEX_Checkin_State"));

  context.updateCheckinState(
    state,
    { found: false, rowNumber: null },
    "AJJ003",
    "today",
    12,
    {
      trainingType: "Gi",
      displayName: "Gi",
      trainingStartText: "18:00",
      trainingKey: "today|Gi|18:00"
    }
  );

  assert.equal(cache.get("AXIS_FAST_ROW_INDEX_Checkin_State"), null);
  assert.equal(state.values[1][0], "AJJ003");
});

test("optimized hot path preserves success, message rotation, attendance and duplicate behavior", () => {
  const { context } = loadCode();
  const RealDate = Date;
  const fixedNow = new RealDate("2026-08-25T18:00:00+02:00");

  class FixedDate extends RealDate {
    constructor(...args) {
      super(...(args.length ? args : [fixedNow.getTime()]));
    }

    static now() {
      return fixedNow.getTime();
    }
  }

  context.Date = FixedDate;

  const sheets = {
    Attendance: new FakeSheet("Attendance", [[
      "Timestamp", "MemberID", "Vorname", "Nachname", "TrainingType",
      "TrainingName", "TrainingStart", "ContentID", "MessageSource",
      "MissedTrainingDays", "MessageCycleStatus", "SeenSuitableMessages"
    ]]),
    Mitglieder: new FakeSheet("Mitglieder", [
      ["MemberID", "Vorname", "Nachname", "Kategorie", "Geburtsdatum"],
      ["AJJ001", "Anna", "Axis", "Erwachsene", ""]
    ]),
    Training_Schedule: new FakeSheet("Training_Schedule", [
      ["Active", "TrainingType", "DisplayName", "DayOfWeek", "StartTime", "Audience"],
      [true, "Gi", "Gi Training", "Dienstag", "18:00", "Erwachsene"]
    ]),
    Checkin_State: new FakeSheet("Checkin_State", [
      ["MemberID", "LastCheckin", "LastAttendanceRow", "LastTrainingType", "LastTrainingName", "LastTrainingStart", "LastTrainingKey"],
      ["AJJ001", new FixedDate("2026-08-18T18:00:00+02:00"), 20, "Gi", "Gi Training", "18:00", "2026-08-18|Gi|18:00"]
    ]),
    Personal_Checkin: new FakeSheet("Personal_Checkin", [[
      "Active", "MemberID", "Message", "ShowOnce", "UsedAt"
    ]]),
    Checkin_Content: new FakeSheet("Checkin_Content", [
      ["Active", "ContentID", "RuleType", "Category", "AgeMin", "AgeMax", "TrainingType", "MissedMin", "MissedMax", "Message", "Weight", "ContentKind"],
      [true, "C001", "normal", "all", "", "", "all", "", "", "Train smart", 1, "coach_tip"]
    ]),
    Checkin_Message_State: new FakeSheet("Checkin_Message_State", [[
      "MemberID", "SeenContentIDs", "LastCycleStatus", "CycleRestartCount", "LastUpdate"
    ]])
  };

  context.SpreadsheetApp = {
    getActiveSpreadsheet() {
      return {
        getSheetByName(name) {
          return sheets[name] || null;
        }
      };
    }
  };

  const success = context.processFastCheckinApi("AJJ001");

  assert.deepEqual(
    Object.keys(success).sort(),
    [
      "color", "contentId", "memberId", "message", "messageCycleStatus",
      "messageSource", "missedTrainingDays", "result", "seenSuitableMessages",
      "sound", "subtitle", "title", "trainingAudience", "trainingName",
      "trainingStart", "trainingType", "vorname"
    ].sort()
  );
  assert.equal(success.result, "success");
  assert.equal(success.contentId, "C001");
  assert.equal(success.messageCycleStatus, "new");
  assert.equal(sheets.Attendance.values.length, 2);
  assert.equal(sheets.Attendance.values[1][1], "AJJ001");
  assert.equal(sheets.Attendance.values[1][7], "C001");
  assert.equal(sheets.Checkin_Message_State.values[1][0], "AJJ001");
  assert.equal(sheets.Checkin_Message_State.values[1][1], "C001");
  assert.equal(sheets.Checkin_State.values[1][6], "2026-08-25|Gi|18:00");

  const duplicate = context.processFastCheckinApi("AJJ001");

  assert.equal(duplicate.result, "duplicate");
  assert.match(duplicate.title, /Bereits eingecheckt/);
  assert.equal(sheets.Attendance.values.length, 2);
  assert.equal(sheets.Checkin_Message_State.values.length, 2);
});

test("personal ShowOnce remains immediate and bypasses normal content rotation", () => {
  const { context } = loadCode();
  const personal = new FakeSheet("Personal_Checkin", [
    ["Active", "MemberID", "Message", "ShowOnce", "UsedAt"],
    [true, "AJJ010", "Personal message", true, ""]
  ]);
  const content = new FakeSheet("Checkin_Content", [
    ["Active", "ContentID", "Message"],
    [true, "C999", "Normal message"]
  ]);
  const ss = {
    getSheetByName(name) {
      if (name === "Personal_Checkin") return personal;
      if (name === "Checkin_Content") return content;
      return null;
    }
  };
  const messageState = new FakeSheet("Checkin_Message_State", [[
    "MemberID", "SeenContentIDs", "LastCycleStatus", "CycleRestartCount", "LastUpdate"
  ]]);

  const result = context.getFastSmartMessage(
    ss,
    { memberId: "AJJ010", vorname: "Ada", category: "Erwachsene", age: 30 },
    0,
    { trainingType: "Gi" }
  );

  assert.equal(result.source, "personal");
  assert.equal(result.contentId, "PERSONAL");
  assert.equal(personal.values[1][0], false);
  assert.ok(personal.values[1][4] instanceof Date);
  assert.equal(content.reads.length, 0);
  assert.equal(messageState.values.length, 1);
});

test("completed content cycle still restarts and updates the same member state", () => {
  const { context } = loadCode();
  const messageState = new FakeSheet("Checkin_Message_State", [
    ["MemberID", "SeenContentIDs", "LastCycleStatus", "CycleRestartCount", "LastUpdate"],
    ["AJJ020", "C001", "new", 2, "old"]
  ]);
  const contentData = [
    ["Active", "ContentID", "RuleType", "Category", "AgeMin", "AgeMax", "TrainingType", "MissedMin", "MissedMax", "Message", "Weight", "ContentKind"],
    [true, "C001", "normal", "all", "", "", "all", "", "", "Again", 1, "coach_tip"]
  ];

  const result = context.getNonRepeatingCheckinContent(
    contentData,
    { memberId: "AJJ020", category: "Erwachsene", age: 30 },
    0,
    { trainingType: "Gi" },
    messageState
  );

  assert.equal(result.contentId, "C001");
  assert.equal(result.cycleStatus, "cycle_restart");
  assert.equal(messageState.values[1][1], "C001");
  assert.equal(messageState.values[1][2], "cycle_restart");
  assert.equal(messageState.values[1][3], 3);
});
