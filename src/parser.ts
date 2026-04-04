import { App, TFile, TFolder, parseYaml } from 'obsidian';
import { Topic, Chapter, ChapterStatus, SessionLogEntry, TopicStatus } from './types';

export const LEARNING_FOLDER = 'Learning';

export class LearningParser {
	constructor(private app: App) {}

	async getTopics(): Promise<Topic[]> {
		const folder = this.app.vault.getAbstractFileByPath(LEARNING_FOLDER);
		if (!(folder instanceof TFolder)) return [];

		const topics: Topic[] = [];
		for (const child of folder.children) {
			if (child instanceof TFolder) {
				const topic = await this.parseTopic(child);
				if (topic) topics.push(topic);
			}
		}
		return topics.sort((a, b) => {
			const statusOrder: Record<TopicStatus, number> = { active: 0, paused: 1, completed: 2, archived: 3 };
			return statusOrder[a.status] - statusOrder[b.status];
		});
	}

	async parseTopic(folder: TFolder): Promise<Topic | null> {
		const progressPath = `${folder.path}/progress.md`;
		const progressFile = this.app.vault.getAbstractFileByPath(progressPath);
		if (!(progressFile instanceof TFile)) return null;

		const content = await this.app.vault.read(progressFile);
		const fm = this.parseFrontmatter(content);
		const chapters = this.parseChapterTable(content);
		const sessionLog = this.parseSessionLog(content);
		const currentPos = this.parseCurrentPosition(content);
		const keyTakeaways = this.parseBulletSection(content, 'Key Takeaways');
		const struggles = this.parseBulletSection(content, 'Struggles & Questions');

		return {
			name: fm.topic || folder.name,
			slug: fm.slug || folder.name,
			status: (fm.status as TopicStatus) || 'active',
			planVersion: fm['plan-version'] || '1.0',
			started: fm.started || '',
			lastSession: fm['last-session'] || '',
			totalSessions: parseInt(fm['total-sessions']) || 0,
			totalHours: parseFloat(fm['total-hours']) || 0,
			chapters,
			currentChapter: currentPos.chapter,
			currentChapterTitle: currentPos.chapterTitle,
			currentStatus: currentPos.status,
			nextUp: currentPos.nextUp,
			confidence: currentPos.confidence,
			tags: fm.tags || [],
			keyTakeaways,
			struggles,
			sessionLog,
		};
	}

	parseFrontmatter(content: string): Record<string, string | string[]> {
		const match = content.match(/^---\n([\s\S]*?)\n---/);
		if (!match) return {};
		try {
			return parseYaml(match[1]) || {};
		} catch {
			return {};
		}
	}

	parseChapterTable(content: string): Chapter[] {
		const tableText = this.extractTableAfterHeader(content, 'Chapter Progress');
		if (!tableText) return [];

		const rows = this.parseMarkdownTable(tableText);
		if (rows.length < 2) return []; // Need header + at least one data row

		return rows.slice(1).map(cells => ({
			number: parseInt(cells[0]) || 0,
			title: cells[1] || '',
			status: this.normalizeChapterStatus(cells[2]),
			confidence: parseInt((cells[3] || '0').split('/')[0]) || 0,
			sessions: parseInt(cells[4]) || 0,
			notes: cells[5] || '',
		})).filter(ch => ch.number > 0);
	}

	parseSessionLog(content: string): SessionLogEntry[] {
		const tableText = this.extractTableAfterHeader(content, 'Session Log');
		if (!tableText) return [];

		const rows = this.parseMarkdownTable(tableText);
		if (rows.length < 2) return [];

		return rows.slice(1).map(cells => ({
			date: cells[0] || '',
			lessonFile: (cells[1] || '').replace(/\[\[|\]\]/g, ''),
			summary: cells[2] || '',
		})).filter(e => e.date);
	}

	parseCurrentPosition(content: string): {
		chapter: number;
		chapterTitle: string;
		status: string;
		confidence: number;
		nextUp: string;
	} {
		const section = this.extractSection(content, 'Current Position');
		const chapterMatch = section.match(/\*\*Chapter\*\*:\s*(.+)/);
		const statusMatch = section.match(/\*\*Status\*\*:\s*(.+)/);
		const confMatch = section.match(/\*\*Confidence\*\*:\s*(\d+)/);
		const nextMatch = section.match(/\*\*Next up\*\*:\s*(.+)/);

		let chapterNum = 0;
		let chapterTitle = '';
		if (chapterMatch) {
			const text = chapterMatch[1].trim();
			const numMatch = text.match(/^(\d+)/);
			if (numMatch) {
				chapterNum = parseInt(numMatch[1]);
				chapterTitle = text.replace(/^\d+[.:\-—–\s]*/, '').trim();
			} else {
				chapterTitle = text;
			}
		}

		return {
			chapter: chapterNum,
			chapterTitle,
			status: statusMatch ? statusMatch[1].trim() : 'not-started',
			confidence: confMatch ? parseInt(confMatch[1]) : 0,
			nextUp: nextMatch ? nextMatch[1].trim() : '',
		};
	}

	parseBulletSection(content: string, header: string): string[] {
		const section = this.extractSection(content, header);
		return section
			.split('\n')
			.filter(line => line.trim().startsWith('- '))
			.map(line => line.trim().replace(/^- /, ''));
	}

	// --- File modification ---

	async updateChapterConfidence(slug: string, chapterNum: number, newConfidence: number): Promise<void> {
		const file = this.getProgressFile(slug);
		if (!file) return;

		const content = await this.app.vault.read(file);
		const updated = this.replaceInChapterTable(content, chapterNum, 3, `${newConfidence}/5`);
		await this.app.vault.modify(file, updated);
	}

	async updateChapterStatus(slug: string, chapterNum: number, newStatus: ChapterStatus): Promise<void> {
		const file = this.getProgressFile(slug);
		if (!file) return;

		const content = await this.app.vault.read(file);
		const updated = this.replaceInChapterTable(content, chapterNum, 2, newStatus);
		await this.app.vault.modify(file, updated);
	}

	async updateTopicStatus(slug: string, newStatus: TopicStatus): Promise<void> {
		const file = this.getProgressFile(slug);
		if (!file) return;

		let content = await this.app.vault.read(file);
		content = content.replace(/^(status:\s*).*$/m, `$1${newStatus}`);
		await this.app.vault.modify(file, content);
	}

	async createTopic(name: string): Promise<string> {
		const slug = this.slugify(name);
		const today = new Date().toISOString().split('T')[0];
		const folderPath = `${LEARNING_FOLDER}/${slug}`;

		// Ensure Learning folder exists
		if (!this.app.vault.getAbstractFileByPath(LEARNING_FOLDER)) {
			await this.app.vault.createFolder(LEARNING_FOLDER);
		}
		await this.app.vault.createFolder(folderPath);

		// Create plan.md
		await this.app.vault.create(`${folderPath}/plan.md`, [
			'---',
			`topic: "${name}"`,
			`slug: ${slug}`,
			'version: "1.0"',
			`created: ${today}`,
			`updated: ${today}`,
			'estimated-hours: 0',
			'tags: [learning]',
			'---',
			'',
			`# ${name} — Curriculum v1.0`,
			'',
			'## Goals',
			'- Define your learning goals here',
			'',
			'## Prerequisites',
			'- None specified',
			'',
			'## Chapters',
			'',
			'*Use `/learn` in Claude Code or paste CONTEXT.md into your AI to build a curriculum.*',
			'',
			'## Resources',
			'- Add resources here',
			'',
			'---',
			'',
			'<details>',
			'<summary>Previous versions</summary>',
			'',
			'</details>',
		].join('\n'));

		// Create progress.md
		await this.app.vault.create(`${folderPath}/progress.md`, [
			'---',
			`topic: "${name}"`,
			`slug: ${slug}`,
			'status: active',
			'plan-version: "1.0"',
			`started: ${today}`,
			`last-session: ${today}`,
			'total-sessions: 0',
			'total-hours: 0',
			'tags: [learning, progress]',
			'---',
			'',
			`# ${name} — Progress`,
			'',
			'## Current Position',
			'- **Chapter**: Not started',
			'- **Status**: not-started',
			'- **Confidence**: 0/5',
			'- **Next up**: Build curriculum with your AI tutor',
			'',
			'## Chapter Progress',
			'',
			'| # | Chapter | Status | Confidence | Sessions | Notes |',
			'|---|---------|--------|------------|----------|-------|',
			'',
			'## Key Takeaways',
			'',
			'## Struggles & Questions',
			'',
			'## Session Log',
			'| Date | Lesson File | Summary |',
			'|------|-------------|---------|',
		].join('\n'));

		// Update INDEX.md
		await this.addToIndex(name, slug, today);

		return slug;
	}

	// --- Private helpers ---

	private getProgressFile(slug: string): TFile | null {
		const file = this.app.vault.getAbstractFileByPath(`${LEARNING_FOLDER}/${slug}/progress.md`);
		return file instanceof TFile ? file : null;
	}

	private replaceInChapterTable(content: string, chapterNum: number, colIndex: number, newValue: string): string {
		const lines = content.split('\n');
		let inSection = false;

		for (let i = 0; i < lines.length; i++) {
			if (lines[i].match(/^##\s+Chapter Progress/)) {
				inSection = true;
				continue;
			}
			if (inSection && lines[i].match(/^##\s/) && !lines[i].match(/^##\s+Chapter Progress/)) {
				break;
			}
			if (inSection && lines[i].startsWith('|') && !lines[i].match(/^\|[\s\-:|]+\|$/)) {
				const cells = lines[i].split('|').slice(1, -1).map(c => c.trim());
				if (parseInt(cells[0]) === chapterNum) {
					cells[colIndex] = newValue;
					lines[i] = '| ' + cells.join(' | ') + ' |';
					break;
				}
			}
		}
		return lines.join('\n');
	}

	private async addToIndex(name: string, slug: string, today: string): Promise<void> {
		const indexFile = this.app.vault.getAbstractFileByPath(`${LEARNING_FOLDER}/INDEX.md`);
		if (!(indexFile instanceof TFile)) return;

		let content = await this.app.vault.read(indexFile);
		const newRow = `| [[Learning/${slug}/progress\\|${name}]] | active | 0/0 chapters | v1.0 | ${today} | ${today} |`;

		// Update the "updated" date in frontmatter
		content = content.replace(/^(updated:\s*).*$/m, `$1${today}`);

		// Insert row before the empty line after the table header separator
		const tableEndMatch = content.match(/(\|[-\s|]+\|)\n/);
		if (tableEndMatch) {
			const insertPos = content.indexOf(tableEndMatch[0]) + tableEndMatch[0].length;
			const before = content.slice(0, insertPos);
			const after = content.slice(insertPos);
			// Check if there are already rows or just empty
			if (after.trimStart().startsWith('|')) {
				content = before + newRow + '\n' + after;
			} else {
				content = before + newRow + '\n' + after;
			}
		}

		await this.app.vault.modify(indexFile, content);
	}

	private extractTableAfterHeader(content: string, header: string): string | null {
		const regex = new RegExp(`## ${header.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`);
		const match = content.match(regex);
		if (!match) return null;
		const lines = match[1].trim().split('\n').filter(l => l.startsWith('|'));
		return lines.length >= 2 ? lines.join('\n') : null;
	}

	private parseMarkdownTable(tableText: string): string[][] {
		const lines = tableText.trim().split('\n');
		const rows: string[][] = [];
		for (const line of lines) {
			if (!line.startsWith('|')) continue;
			if (line.match(/^\|[\s\-:|]+\|$/)) continue; // Skip separator
			rows.push(line.split('|').slice(1, -1).map(c => c.trim()));
		}
		return rows;
	}

	private extractSection(content: string, header: string): string {
		const regex = new RegExp(`## ${header.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`);
		const match = content.match(regex);
		return match ? match[1].trim() : '';
	}

	private normalizeChapterStatus(status: string): ChapterStatus {
		const s = (status || '').trim().toLowerCase();
		if (s === 'completed' || s === 'done') return 'completed';
		if (s === 'in-progress' || s === 'in progress' || s === 'started') return 'in-progress';
		return 'not-started';
	}

	private slugify(name: string): string {
		return name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '');
	}
}
