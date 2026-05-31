export type {
  TrainingCourse,
  AgentTrainingLog,
  StationRequiredTraining,
} from '@/shared/types/database';

export interface CreateCourseInput {
  tenant_id: string;
  course_name: string;
  description?: string;
  validity_months?: number;
}

export interface LogTrainingInput {
  tenant_id: string;
  user_id: string;
  course_id: string;
  completion_date: string;
  grade?: string;
  certificate_pdf_url?: string;
}

export interface CertExpiryAlert {
  agentName: string;
  userId: string;
  courseName: string;
  expiryDate: string;
  daysRemaining: number;
}

export interface EligibilityResult {
  eligible: boolean;
  missing: { courseId: string; courseName: string }[];
}
