export enum ClassGrade {
  SIXTH = '6th Grade',
  SEVENTH = '7th Grade',
  EIGHTH = '8th Grade',
  NINTH = '9th Grade',
  TENTH = '10th Grade',
}

export interface DailyAttendanceRecord {
  present: number;
  absent: number;
}

// State will store attendance data like:
// {
//   '6th Grade': {
//     '2024-01-01': { present: 20, absent: 5 },
//     '2024-01-02': { present: 22, absent: 3 },
//   },
//   '7th Grade': { ... }
// }
export type ClassAttendanceData = {
  [grade in ClassGrade]?: {
    [date: string]: DailyAttendanceRecord;
  };
};

export interface ClassSummary {
  grade: ClassGrade;
  totalPresent: number;
  totalAbsent: number;
  presentPercentage: number;
  absentPercentage: number;
}