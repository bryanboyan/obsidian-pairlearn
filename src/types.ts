export type TopicStatus = 'active' | 'paused' | 'completed' | 'archived';
export type ChapterStatus = 'completed' | 'in-progress' | 'not-started';

export interface Topic {
	name: string;
	slug: string;
	status: TopicStatus;
	planVersion: string;
	started: string;
	lastSession: string;
	totalSessions: number;
	totalHours: number;
	chapters: Chapter[];
	currentChapter: number;
	currentChapterTitle: string;
	currentStatus: string;
	nextUp: string;
	confidence: number;
	tags: string[];
	keyTakeaways: string[];
	struggles: string[];
	sessionLog: SessionLogEntry[];
}

export interface Chapter {
	number: number;
	title: string;
	status: ChapterStatus;
	confidence: number;
	sessions: number;
	notes: string;
}

export interface SessionLogEntry {
	date: string;
	lessonFile: string;
	summary: string;
}
