import { Plugin, WorkspaceLeaf } from 'obsidian';
import { LearningView, VIEW_TYPE_LEARNING } from './learning-view';

export default class LearningPlugin extends Plugin {
	async onload() {
		this.registerView(VIEW_TYPE_LEARNING, (leaf: WorkspaceLeaf) => new LearningView(leaf));

		this.addRibbonIcon('graduation-cap', 'Open PairLearn', () => {
			this.activateView();
		});

		this.addCommand({
			id: 'open-pairlearn',
			name: 'Open PairLearn',
			callback: () => this.activateView(),
		});
	}

	async activateView() {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_LEARNING);
		if (leaves.length > 0) {
			this.app.workspace.revealLeaf(leaves[0]);
		} else {
			const leaf = this.app.workspace.getLeaf(true);
			await leaf.setViewState({ type: VIEW_TYPE_LEARNING, active: true });
			this.app.workspace.revealLeaf(leaf);
		}
	}

	onunload() {}
}
