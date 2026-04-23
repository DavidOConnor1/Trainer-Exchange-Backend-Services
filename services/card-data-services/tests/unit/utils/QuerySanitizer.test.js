import { describe, expect, it } from "@jest/globals";
import { QuerySanitizer } from "../../../api/utils/QuerySanitizer.js";

describe("QuerySanitizer", () => {
  describe("sanitizeString", () => {
    it("should remove control characters", () => {
      const input = "Hello\x00World\x1FTest";
      const result = QuerySanitizer.sanitizeString(input);
      expect(result).toBe("HelloWorldTest");
    });

    it("should remove SQL injection patterns", () => {
      const inputs = [
        "DROP TABLE users",
        "SELECT * FROM cards",
        "INSERT INTO users",
        "DELETE FROM logs",
        "UNION ALL SELECT",
        "ALTER TABLE cards",
      ];

      inputs.forEach((input) => {
        const result = QuerySanitizer.sanitizeString(input);
        expect(result).not.toContain("DROP");
        expect(result).not.toContain("SELECT");
        expect(result).not.toContain("INSERT");
        expect(result).not.toContain("DELETE");
      });
    });

    it("should remove path traversal patterns", () => {
      const inputs = ["../config", "..\\windows", "../../etc/passwd"];

      inputs.forEach((input) => {
        const result = QuerySanitizer.sanitizeString(input);
        expect(result).not.toContain("../");
        expect(result).not.toContain("..\\");
      });
    });

    it("should trim whitespace", () => {
      const result = QuerySanitizer.sanitizeString("  pikachu  ");
      expect(result).toBe("pikachu");
    });

    it("should limit length to 100 characters", () => {
      const longString = "a".repeat(200);
      const result = QuerySanitizer.sanitizeString(longString);
      expect(result.length).toBe(100);
    });

    it("should return empty string for non-string input", () => {
      expect(QuerySanitizer.sanitizeString(null)).toBe("");
      expect(QuerySanitizer.sanitizeString(undefined)).toBe("");
      expect(QuerySanitizer.sanitizeString(123)).toBe("");
      expect(QuerySanitizer.sanitizeString({})).toBe("");
    });
  });

  describe("sanitizeQueryObject", () => {
    it("should sanitize string values", () => {
      const params = { name: "DROP TABLE users", type: "Fire" };
      const result = QuerySanitizer.sanitizeQueryObject(params);
      expect(result.name).not.toContain("DROP");
      expect(result.type).toBe("Fire");
    });

    it("should handle nested objects", () => {
      const params = {
        filters: {
          name: "SELECT * FROM cards",
          hp: 100,
        },
      };
      const result = QuerySanitizer.sanitizeQueryObject(params);
      expect(result.filters.name).not.toContain("SELECT");
      expect(result.filters.hp).toBe(100);
    });

    it("should handle arrays", () => {
      const params = { types: ["Fire", "DROP TABLE", "Water"] };
      const result = QuerySanitizer.sanitizeQueryObject(params);
      expect(result.types[0]).toBe("Fire");
      expect(result.types[1]).not.toContain("DROP");
      expect(result.types[2]).toBe("Water");
    });

    it("should handle numbers", () => {
      const params = { hp: 100, attack: NaN, defense: Infinity };
      const result = QuerySanitizer.sanitizeQueryObject(params);
      expect(result.hp).toBe(100);
      expect(result.attack).toBe(0);
      expect(result.defense).toBe(0);
    });

    it("should return empty object for invalid input", () => {
      expect(QuerySanitizer.sanitizeQueryObject(null)).toEqual({});
      expect(QuerySanitizer.sanitizeQueryObject(undefined)).toEqual({});
      expect(QuerySanitizer.sanitizeQueryObject("string")).toEqual({});
    });
  });

  describe("validateCardName", () => {
    it("should return sanitized name for valid input", () => {
      const result = QuerySanitizer.validateCardName("Pikachu");
      expect(result).toBe("Pikachu");
    });

    it("should return null for empty input", () => {
      expect(QuerySanitizer.validateCardName("")).toBeNull();
      expect(QuerySanitizer.validateCardName("   ")).toBeNull();
      expect(QuerySanitizer.validateCardName(null)).toBeNull();
      expect(QuerySanitizer.validateCardName(undefined)).toBeNull();
    });

    it("should reject names longer than 30 characters", () => {
      const longName = "a".repeat(31);
      expect(QuerySanitizer.validateCardName(longName)).toBeNull();
    });

    it("should accept names up to 30 characters", () => {
      const validName = "a".repeat(30);
      expect(QuerySanitizer.validateCardName(validName)).toBe(validName);
    });
  });
});
