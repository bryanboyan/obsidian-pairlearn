import { ItemView, WorkspaceLeaf, TFile, Notice, setIcon } from 'obsidian';
import { LearningParser, LEARNING_FOLDER } from './parser';
import { Topic, Chapter, TopicStatus } from './types';
import { NewTopicModal, ConfirmModal } from './modals';

export const VIEW_TYPE_LEARNING = 'pairlearn-view';

type ViewState = { mode: 'hub' } | { mode: 'topic'; slug: string };

export class LearningView extends ItemView {
	private parser: LearningParser;
	private state: ViewState = { mode: 'hub' };
	private fileChangeHandler: (() => void) | null = null;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
		this.parser = new LearningParser(this.app);
	}

	getViewType(): string {
		return VIEW_TYPE_LEARNING;
	}

	getDisplayText(): string {
		return 'PairLearn';
	}

	getIcon(): string {
		return 'graduation-cap';
	}

	async onOpen() {
		this.fileChangeHandler = () => {
			// Debounced re-render on file changes in Learning/
			this.debouncedRender();
		};
		this.registerEvent(this.app.vault.on('modify', (file) => {
			if (file.path.startsWith(LEARNING_FOLDER + '/')) {
				this.fileChangeHandler?.();
			}
		}));
		this.registerEvent(this.app.vault.on('create', (file) => {
			if (file.path.startsWith(LEARNING_FOLDER + '/')) {
				this.fileChangeHandler?.();
			}
		}));
		this.registerEvent(this.app.vault.on('delete', (file) => {
			if (file.path.startsWith(LEARNING_FOLDER + '/')) {
				this.fileChangeHandler?.();
			}
		}));

		await this.render();
	}

	private renderTimeout: ReturnType<typeof setTimeout> | null = null;
	private debouncedRender() {
		if (this.renderTimeout) clearTimeout(this.renderTimeout);
		this.renderTimeout = setTimeout(() => { void this.render(); }, 300);
	}

	onClose() {
		if (this.renderTimeout) clearTimeout(this.renderTimeout);
	}

	private async render() {
		if (this.state.mode === 'hub') {
			await this.renderHub();
		} else {
			await this.renderTopicDashboard(this.state.slug);
		}
	}

	// ──────────────────────────────────────
	// Hub View
	// ──────────────────────────────────────

	private async renderHub() {
		const el = this.contentEl;
		el.empty();
		el.addClass('learning-root');

		// Header
		const header = el.createDiv({ cls: 'learning-header' });
		const titleRow = header.createDiv({ cls: 'learning-header-row' });
		titleRow.createEl('h2', { text: 'PairLearn', cls: 'learning-title' });
		const actions = titleRow.createDiv({ cls: 'learning-header-actions' });

		const refreshBtn = actions.createEl('button', { cls: 'learning-btn-icon', attr: { 'aria-label': 'Refresh' } });
		setIcon(refreshBtn, 'refresh-cw');
		refreshBtn.onclick = () => { void this.render(); };

		const newBtn = actions.createEl('button', { text: '+ New topic', cls: 'learning-btn-primary' });
		newBtn.onclick = () => this.showNewTopicModal();

		// Load topics
		const topics = await this.parser.getTopics();

		if (topics.length === 0) {
			this.renderEmptyState(el);
			return;
		}

		// Filter bar
		const filterBar = el.createDiv({ cls: 'learning-filter-bar' });
		const statuses: (TopicStatus | 'all')[] = ['all', 'active', 'paused', 'completed', 'archived'];
		for (const status of statuses) {
			const btn = filterBar.createEl('button', {
				text: status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1),
				cls: 'learning-filter-btn',
			});
			if (status === 'all') btn.addClass('is-active');
			btn.onclick = () => {
				filterBar.querySelectorAll('.learning-filter-btn').forEach(b => b.removeClass('is-active'));
				btn.addClass('is-active');
				this.filterTopics(el, topics, status);
			};
		}

		// Topics grid
		const grid = el.createDiv({ cls: 'learning-grid' });
		for (const topic of topics) {
			this.renderTopicCard(grid, topic);
		}
	}

	private renderEmptyState(parent: HTMLElement) {
		const empty = parent.createDiv({ cls: 'learning-empty' });
		empty.createDiv({ cls: 'learning-empty-icon', text: '\uD83C\uDF93' });
		empty.createEl('h3', { text: 'Start your learning journey' });
		empty.createEl('p', { text: 'Click "+ New topic" above, or use /learn in Claude Code.' });
	}

	private filterTopics(el: HTMLElement, topics: Topic[], status: TopicStatus | 'all') {
		const grid = el.querySelector('.learning-grid');
		if (!grid) return;
		grid.empty();
		const filtered = status === 'all' ? topics : topics.filter(t => t.status === status);
		for (const topic of filtered) {
			this.renderTopicCard(grid as HTMLElement, topic);
		}
		if (filtered.length === 0) {
			(grid as HTMLElement).createDiv({ cls: 'learning-empty-filter', text: `No ${status} topics.` });
		}
	}

	private renderTopicCard(parent: HTMLElement, topic: Topic) {
		const card = parent.createDiv({ cls: 'learning-card' });
		card.onclick = () => this.navigateToTopic(topic.slug);

		// Top row: status + title
		const topRow = card.createDiv({ cls: 'learning-card-top' });
		topRow.createSpan({ cls: `learning-status-dot learning-status-${topic.status}` });
		topRow.createSpan({ text: topic.name, cls: 'learning-card-title' });

		// Progress bar
		const completedChapters = topic.chapters.filter(c => c.status === 'completed').length;
		const totalChapters = topic.chapters.length;
		const progressPct = totalChapters > 0 ? (completedChapters / totalChapters) * 100 : 0;

		const progressRow = card.createDiv({ cls: 'learning-card-progress' });
		const bar = progressRow.createDiv({ cls: 'learning-progress-bar' });
		const fill = bar.createDiv({ cls: 'learning-progress-fill' });
		fill.style.width = `${progressPct}%`;
		progressRow.createSpan({
			text: totalChapters > 0 ? `${completedChapters}/${totalChapters} chapters` : 'No chapters yet',
			cls: 'learning-card-progress-text',
		});

		// Meta row
		const meta = card.createDiv({ cls: 'learning-card-meta' });
		const metaParts: string[] = [];
		if (topic.planVersion) metaParts.push(`v${topic.planVersion}`);
		if (topic.totalSessions > 0) metaParts.push(`${topic.totalSessions} sessions`);
		if (topic.lastSession) metaParts.push(`Last: ${topic.lastSession}`);
		meta.createSpan({ text: metaParts.join(' \u00B7 '), cls: 'learning-card-meta-text' });

		// Next up
		if (topic.nextUp) {
			const next = card.createDiv({ cls: 'learning-card-next' });
			next.createSpan({ text: 'Next: ', cls: 'learning-card-next-label' });
			next.createSpan({ text: topic.nextUp, cls: 'learning-card-next-text' });
		}
	}

	// ──────────────────────────────────────
	// Topic Dashboard
	// ──────────────────────────────────────

	private async renderTopicDashboard(slug: string) {
		const el = this.contentEl;
		el.empty();
		el.addClass('learning-root');

		const topics = await this.parser.getTopics();
		const topic = topics.find(t => t.slug === slug);

		if (!topic) {
			el.createEl('p', { text: 'Topic not found.' });
			const back = el.createEl('button', { text: '\u2190 back', cls: 'learning-btn-ghost' });
			back.onclick = () => this.navigateToHub();
			return;
		}

		// Header
		const header = el.createDiv({ cls: 'learning-header' });
		const titleRow = header.createDiv({ cls: 'learning-header-row' });
		const backBtn = titleRow.createEl('button', { cls: 'learning-btn-ghost learning-back-btn' });
		setIcon(backBtn, 'arrow-left');
		backBtn.createSpan({ text: ' Back' });
		backBtn.onclick = () => this.navigateToHub();

		const titleRight = titleRow.createDiv({ cls: 'learning-header-right' });
		titleRight.createEl('h2', { text: topic.name, cls: 'learning-title' });
		titleRight.createSpan({ cls: `learning-status-badge learning-status-${topic.status}`, text: topic.status });

		// Overview card
		const overview = el.createDiv({ cls: 'learning-section learning-overview' });
		const overviewGrid = overview.createDiv({ cls: 'learning-overview-grid' });
		this.renderStat(overviewGrid, 'Started', topic.started || '—');
		this.renderStat(overviewGrid, 'Sessions', String(topic.totalSessions));
		this.renderStat(overviewGrid, 'Hours', String(topic.totalHours));
		this.renderStat(overviewGrid, 'Plan', `v${topic.planVersion}`);

		const completedChapters = topic.chapters.filter(c => c.status === 'completed').length;
		const totalChapters = topic.chapters.length;
		const progressPct = totalChapters > 0 ? (completedChapters / totalChapters) * 100 : 0;

		const progressContainer = overview.createDiv({ cls: 'learning-overview-progress' });
		const bar = progressContainer.createDiv({ cls: 'learning-progress-bar learning-progress-bar-lg' });
		bar.createDiv({ cls: 'learning-progress-fill' }).style.width = `${progressPct}%`;
		progressContainer.createSpan({
			text: totalChapters > 0 ? `${Math.round(progressPct)}% complete (${completedChapters}/${totalChapters} chapters)` : 'No chapters yet',
			cls: 'learning-progress-label',
		});

		// Current Position card
		const currentCard = el.createDiv({ cls: 'learning-section learning-current' });
		currentCard.createEl('h3', { text: 'Current position', cls: 'learning-section-title' });
		const currentBody = currentCard.createDiv({ cls: 'learning-current-body' });

		if (topic.currentChapterTitle && topic.currentChapterTitle !== 'Not started') {
			currentBody.createDiv({
				text: topic.currentChapter > 0
					? `Chapter ${topic.currentChapter}: ${topic.currentChapterTitle}`
					: topic.currentChapterTitle,
				cls: 'learning-current-chapter',
			});

			const currentMeta = currentBody.createDiv({ cls: 'learning-current-meta' });
			currentMeta.createSpan({ text: `Status: ${topic.currentStatus}`, cls: 'learning-current-status' });
			this.renderConfidenceStars(currentMeta, topic.confidence, true, slug, topic.currentChapter);
		} else {
			currentBody.createDiv({ text: 'Not started yet', cls: 'learning-current-chapter learning-text-muted' });
		}

		if (topic.nextUp) {
			currentBody.createDiv({ cls: 'learning-current-next' }).createEl('span', {
				text: `Next: ${topic.nextUp}`,
			});
		}

		// Action buttons
		const actionRow = currentCard.createDiv({ cls: 'learning-action-row' });
		const continueBtn = actionRow.createEl('button', { text: 'Open progress', cls: 'learning-btn-primary' });
		continueBtn.onclick = () => this.openFile(`${LEARNING_FOLDER}/${slug}/progress.md`);
		const planBtn = actionRow.createEl('button', { text: 'Open plan', cls: 'learning-btn-secondary' });
		planBtn.onclick = () => this.openFile(`${LEARNING_FOLDER}/${slug}/plan.md`);

		// Chapters
		if (topic.chapters.length > 0) {
			const chaptersSection = el.createDiv({ cls: 'learning-section' });
			chaptersSection.createEl('h3', { text: 'Chapters', cls: 'learning-section-title' });
			const chapterList = chaptersSection.createDiv({ cls: 'learning-chapter-list' });

			for (const chapter of topic.chapters) {
				this.renderChapterRow(chapterList, chapter, slug);
			}
		}

		// Key Takeaways
		if (topic.keyTakeaways.length > 0) {
			const takeawaysSection = el.createDiv({ cls: 'learning-section' });
			takeawaysSection.createEl('h3', { text: 'Key takeaways', cls: 'learning-section-title' });
			const list = takeawaysSection.createEl('ul', { cls: 'learning-bullet-list' });
			for (const item of topic.keyTakeaways) {
				list.createEl('li', { text: item });
			}
		}

		// Struggles
		if (topic.struggles.length > 0) {
			const strugglesSection = el.createDiv({ cls: 'learning-section' });
			strugglesSection.createEl('h3', { text: 'Struggles & questions', cls: 'learning-section-title' });
			const list = strugglesSection.createEl('ul', { cls: 'learning-bullet-list learning-struggles' });
			for (const item of topic.struggles) {
				list.createEl('li', { text: item });
			}
		}

		// Session Log
		if (topic.sessionLog.length > 0) {
			const sessionsSection = el.createDiv({ cls: 'learning-section' });
			sessionsSection.createEl('h3', { text: 'Recent lessons', cls: 'learning-section-title' });
			const sessionList = sessionsSection.createDiv({ cls: 'learning-session-list' });

			for (const entry of topic.sessionLog.slice().reverse()) {
				const row = sessionList.createDiv({ cls: 'learning-session-row' });
				row.createSpan({ text: entry.date, cls: 'learning-session-date' });
				row.createSpan({ text: entry.summary, cls: 'learning-session-summary' });
				if (entry.lessonFile) {
					const openBtn = row.createEl('button', { text: 'Open', cls: 'learning-btn-ghost learning-btn-sm' });
					openBtn.onclick = (e) => {
						e.stopPropagation();
						// Resolve the lesson file path relative to the topic folder
						let path = entry.lessonFile;
						if (!path.startsWith(LEARNING_FOLDER)) {
							path = `${LEARNING_FOLDER}/${slug}/${path}`;
						}
						this.openFile(path);
					};
				}
			}
		}

		// Footer actions
		const footer = el.createDiv({ cls: 'learning-footer-actions' });
		if (topic.status === 'active') {
			const pauseBtn = footer.createEl('button', { text: 'Pause topic', cls: 'learning-btn-ghost' });
			pauseBtn.onclick = () => this.setTopicStatus(slug, 'paused');
		}
		if (topic.status === 'paused') {
			const resumeBtn = footer.createEl('button', { text: 'Resume topic', cls: 'learning-btn-secondary' });
			resumeBtn.onclick = () => this.setTopicStatus(slug, 'active');
		}
		if (topic.status !== 'archived') {
			const archiveBtn = footer.createEl('button', { text: 'Archive', cls: 'learning-btn-ghost learning-btn-danger' });
			archiveBtn.onclick = () => {
				new ConfirmModal(this.app, `Archive "${topic.name}"? You can restore it later.`, () => {
					void this.setTopicStatus(slug, 'archived');
				}).open();
			};
		}
		if (topic.status === 'archived') {
			const restoreBtn = footer.createEl('button', { text: 'Restore topic', cls: 'learning-btn-secondary' });
			restoreBtn.onclick = () => this.setTopicStatus(slug, 'active');
		}
	}

	private renderStat(parent: HTMLElement, label: string, value: string) {
		const stat = parent.createDiv({ cls: 'learning-stat' });
		stat.createDiv({ text: value, cls: 'learning-stat-value' });
		stat.createDiv({ text: label, cls: 'learning-stat-label' });
	}

	private renderChapterRow(parent: HTMLElement, chapter: Chapter, slug: string) {
		const row = parent.createDiv({ cls: `learning-chapter-row learning-chapter-${chapter.status}` });

		// Checkbox
		const checkbox = row.createEl('input', {
			type: 'checkbox',
			cls: 'learning-chapter-checkbox',
		});
		if (chapter.status === 'completed') checkbox.checked = true;
		if (chapter.status === 'in-progress') checkbox.indeterminate = true;
		checkbox.onclick = async (e) => {
			e.stopPropagation();
			const newStatus = checkbox.checked ? 'completed' : 'not-started';
			await this.parser.updateChapterStatus(slug, chapter.number, newStatus);
			new Notice(`Chapter ${chapter.number} marked as ${newStatus}`);
		};

		// Number + Title
		const info = row.createDiv({ cls: 'learning-chapter-info' });
		info.createSpan({ text: `${chapter.number}. ${chapter.title}`, cls: 'learning-chapter-title' });
		if (chapter.notes) {
			info.createSpan({ text: chapter.notes, cls: 'learning-chapter-notes' });
		}

		// Confidence stars
		const right = row.createDiv({ cls: 'learning-chapter-right' });
		this.renderConfidenceStars(right, chapter.confidence, true, slug, chapter.number);
		if (chapter.sessions > 0) {
			right.createSpan({ text: `${chapter.sessions} sess`, cls: 'learning-chapter-sessions' });
		}
	}

	private renderConfidenceStars(
		parent: HTMLElement,
		confidence: number,
		interactive: boolean,
		slug: string,
		chapterNum: number,
	) {
		const container = parent.createSpan({ cls: 'learning-stars' });
		for (let i = 1; i <= 5; i++) {
			const star = container.createSpan({
				text: i <= confidence ? '\u2605' : '\u2606',
				cls: `learning-star ${i <= confidence ? 'learning-star-filled' : 'learning-star-empty'}`,
			});
			if (interactive) {
				star.addClass('learning-star-interactive');
				star.onclick = async (e) => {
					e.stopPropagation();
					await this.parser.updateChapterConfidence(slug, chapterNum, i);
					new Notice(`Confidence set to ${i}/5`);
				};
			}
		}
	}

	// ──────────────────────────────────────
	// Navigation & Actions
	// ──────────────────────────────────────

	private navigateToHub() {
		this.state = { mode: 'hub' };
		void this.render();
	}

	private navigateToTopic(slug: string) {
		this.state = { mode: 'topic', slug };
		void this.render();
	}

	private showNewTopicModal() {
		new NewTopicModal(this.app, (name) => {
			void this.parser.createTopic(name).then((slug) => {
				new Notice(`Created topic: ${name}`);
				this.navigateToTopic(slug);
			}).catch((err) => {
				new Notice(`Failed to create topic: ${err}`);
			});
		}).open();
	}

	private async setTopicStatus(slug: string, status: TopicStatus) {
		await this.parser.updateTopicStatus(slug, status);
		new Notice(`Topic ${status}`);
		// Re-render to reflect change
		await this.render();
	}

	private openFile(path: string) {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (file instanceof TFile) {
			void this.app.workspace.getLeaf(true).openFile(file);
		} else {
			new Notice(`File not found: ${path}`);
		}
	}

}
