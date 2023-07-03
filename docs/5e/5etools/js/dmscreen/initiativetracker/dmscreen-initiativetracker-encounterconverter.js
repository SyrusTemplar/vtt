import {InitiativeTrackerStatColumnFactory} from "./dmscreen-initiativetracker-statcolumns.js";

class _ConvertedEncounter {
	constructor () {
		this.isStatsAddColumns = false;

		this.statsCols = [];
		this.rows = [];
	}
}

export class InitiativeTrackerEncounterConverter {
	constructor (
		{
			roller,
			importIsAddPlayers,
			importIsRollGroups,
			isRollInit,
			isRollHp,
		},
	) {
		this._roller = roller;

		this._importIsAddPlayers = importIsAddPlayers;
		this._importIsRollGroups = importIsRollGroups;
		this._isRollInit = isRollInit;
		this._isRollHp = isRollHp;
	}

	async pGetConverted ({entityInfos, encounterInfo}) {
		const out = new _ConvertedEncounter();

		this._pGetConverted_players({entityInfos, encounterInfo, out});
		await this._pGetConverted_pCreatures({entityInfos, encounterInfo, out});

		return out;
	}

	/* -------------------------------------------- */

	_pGetConverted_players ({entityInfos, encounterInfo, out}) {
		if (!this._importIsAddPlayers) return;

		this._pGetConverted_players_advanced({entityInfos, encounterInfo, out});
		this._pGetConverted_players_simple({entityInfos, encounterInfo, out});
	}

	_pGetConverted_players_advanced ({entityInfos, encounterInfo, out}) {
		if (!encounterInfo.isAdvanced || !encounterInfo.playersAdvanced) return;

		const colNameIndex = {};
		encounterInfo.colsExtraAdvanced = encounterInfo.colsExtraAdvanced || [];
		if (encounterInfo.colsExtraAdvanced.length) out.isStatsAddColumns = true;

		encounterInfo.colsExtraAdvanced.forEach((col, i) => colNameIndex[i] = (col?.name || "").toLowerCase());

		const colIndex = {};
		let hpIndex = null;
		encounterInfo.colsExtraAdvanced.forEach((col, i) => {
			let colName = col?.name || "";
			if (colName.toLowerCase() === "hp") {
				hpIndex = i;
				return;
			}

			const newCol = InitiativeTrackerStatColumnFactory.fromEncounterAdvancedColName({colName});
			colIndex[i] = newCol;
			out.statsCols.push(newCol);
		});

		encounterInfo.playersAdvanced.forEach(playerDetails => {
			const row = {
				nameMeta: {
					name: playerDetails.name || "",
				},
				initiative: "",
				isActive: 0,
				conditions: [], // conditions
				isPlayerVisible: true,
			};

			if (playerDetails.extras?.length) { // extra stats
				row.rowStatColData = playerDetails.extras
					.map((extra, i) => {
						const val = extra?.value || "";
						if (i === hpIndex) return null;
						return {id: colIndex[i].id, value: val || ""};
					})
					.filter(Boolean);

				if (hpIndex != null) {
					[row.hpCurrent, row.hpMax] = (playerDetails.extras[hpIndex]?.value || "")
						.split("/")
						.map(it => it.trim());
					if (row.hpMax == null) row.hpMax = row.hpCurrent;
				} else row.hpCurrent = row.hpMax = "";
			} else row.hpCurrent = row.hpMax = "";

			out.rows.push(row);
		});
	}

	_pGetConverted_players_simple ({entityInfos, encounterInfo, out}) {
		if (encounterInfo.isAdvanced || !encounterInfo.playersSimple) return;

		encounterInfo.playersSimple.forEach(playerGroup => {
			[...new Array(playerGroup.count || 1)].forEach(() => {
				out.rows.push({
					nameMeta: {
						name: "",
					},
					hpCurrent: "",
					hpMax: "",
					initiative: "",
					isActive: 0,
					conditions: [],
					isPlayerVisible: true,
				});
			});
		});
	}

	/* -------------------------------------------- */

	async _pGetConverted_pCreatures ({entityInfos, encounterInfo, out}) {
		if (!entityInfos?.length) return;

		await entityInfos
			.filter(Boolean)
			.pSerialAwaitMap(async it => {
				const groupInit = this._importIsRollGroups && this._isRollInit ? await this._roller.pGetRollInitiative(it.entity) : null;
				const groupHp = this._importIsRollGroups ? await this._roller.pGetOrRollHp(it.entity, {isRollHp: this._isRollHp}) : null;

				await [...new Array(it.count || 1)]
					.pSerialAwaitMap(async () => {
						const hpVal = this._importIsRollGroups
							? groupHp
							: await this._roller.pGetOrRollHp(it.entity, {isRollHp: this._isRollHp});

						out.rows.push({
							nameMeta: {
								name: it.entity.name,
								displayName: it.entity._displayName,
								scaledToCr: it.entity._scaledCr,
								scaledToSummonSpellLevel: it.entity._summonedBySpell_level,
								scaledToSummonClassLevel: it.entity._summonedByClass_level,
							},
							initiative: this._isRollInit ? `${this._importIsRollGroups ? groupInit : await this._roller.pGetRollInitiative(it.entity)}` : null,
							isActive: 0,
							source: it.entity.source,
							conditions: [],
							hpCurrent: `${hpVal}`,
							hpMax: `${hpVal}`,
						});
					});
			});
	}
}
