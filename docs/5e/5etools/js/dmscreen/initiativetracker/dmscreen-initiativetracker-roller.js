export class InitiativeTrackerRoller {
	static _getRollName (mon) {
		return `Initiative Tracker \u2014 ${mon.name}`;
	}

	async pGetRollInitiative (mon) {
		return Renderer.dice.pRoll2(`1d20${Parser.getAbilityModifier(mon.dex)}`, {
			isUser: false,
			name: this.constructor._getRollName(mon),
			label: "Initiative",
		}, {isResultUsed: true});
	}

	async pGetOrRollHp (mon, {isRollHp}) {
		if (!isRollHp && mon.hp.average) return `${mon.hp.average}`;

		if (isRollHp && mon.hp.formula) {
			const roll = await Renderer.dice.pRoll2(mon.hp.formula, {
				isUser: false,
				name: this.constructor._getRollName(mon),
				label: "HP",
			}, {isResultUsed: true});
			return `${roll}`;
		}

		return "";
	}
}
