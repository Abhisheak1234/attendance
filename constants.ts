import { ClassGrade } from './types';

export const CLASS_GRADES: ClassGrade[] = [
  ClassGrade.SIXTH,
  ClassGrade.SEVENTH,
  ClassGrade.EIGHTH,
  ClassGrade.NINTH,
  ClassGrade.TENTH,
];

export const CLASS_STRENGTHS: { [key in ClassGrade]: number } = {
  [ClassGrade.SIXTH]: 19,
  [ClassGrade.SEVENTH]: 48,
  [ClassGrade.EIGHTH]: 47,
  [ClassGrade.NINTH]: 56,
  [ClassGrade.TENTH]: 66,
};
