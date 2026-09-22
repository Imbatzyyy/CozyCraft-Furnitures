import { expect, it } from "vitest";
import { reportCsv } from "./report-export";
it("quotes commas, quotes and line breaks and blocks spreadsheet formula injection", () => {
  expect(reportCsv([["=CMD()", "+SUM(1)", "@evil", " normal", 'a"b', "a,b", 12]])).toBe('"\'=CMD()","\'+SUM(1)","\'@evil"," normal","a""b","a,b","12"');
});
