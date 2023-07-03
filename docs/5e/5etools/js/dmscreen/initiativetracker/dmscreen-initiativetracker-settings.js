import {InitiativeTrackerUi} from "./dmscreen-initiativetracker-ui.js";
import {
	InitiativeTrackerStatColumnFactory,
	IS_PLAYER_VISIBLE_ALL,
	IS_PLAYER_VISIBLE_NONE,
	IS_PLAYER_VISIBLE_PLAYER_UNITS_ONLY,
} from "./dmscreen-initiativetracker-statcolumns.js";

class _RenderableCollectionStatsCols extends RenderableCollectionGenericRows {
	constructor (
		{
			comp,

			doClose,
			$wrpRows,
		},
	) {
		super(comp, "statsCols", $wrpRows);
		this._doClose = doClose;
	}

	_populateRow ({comp, $wrpRow, entity}) {
		$wrpRow.addClass("py-1p");

		const ptOptions = InitiativeTrackerStatColumnFactory.getGroupedByUi()
			.map(Clsses => {
				return Clsses
					.map(Cls => `<option value="${Cls.POPULATE_WITH}">${Cls.NAME}</option>`)
					.join("\n");
			})
			.join(`<option disabled>\u2014</option>`);

		const $selPre = $(`
			<select class="form-control input-xs">
				${ptOptions}
			</select>
		`)
			.change(() => {
				const statCol = InitiativeTrackerStatColumnFactory.fromPopulateWith({
					populateWith: $selPre.val() || "",
					populateWithPrevious: comp._state.populateWith,
				});

				const asStateData = statCol.getAsStateData();
				delete asStateData.id;
				comp._proxyAssignSimple("state", asStateData);
			});
		if (comp._state.populateWith) $selPre.val(comp._state.populateWith);

		const $iptAbv = ComponentUiUtil.$getIptStr(comp, "abbreviation");

		const $cbIsEditable = ComponentUiUtil.$getCbBool(comp, "isEditable");

		const $btnVisible = InitiativeTrackerUi.$getBtnPlayerVisible(
			comp._state.isPlayerVisible,
			() => comp._state.isPlayerVisible = $btnVisible.hasClass("btn-primary--half")
				? IS_PLAYER_VISIBLE_PLAYER_UNITS_ONLY
				: $btnVisible.hasClass("btn-primary")
					? IS_PLAYER_VISIBLE_ALL
					: IS_PLAYER_VISIBLE_NONE,
			true,
		);

		const $btnDelete = this._$getBtnDelete({entity});

		const $padDrag = this._$getPadDrag({$wrpRow});

		$$($wrpRow)`
			<div class="col-5 pr-1">${$selPre}</div>
			<div class="col-3 pr-1">${$iptAbv}</div>
			<div class="col-1-5 text-center">${$cbIsEditable}</div>
			<div class="col-1-5 text-center">${$btnVisible}</div>

			<div class="col-0-5 ve-flex-vh-center">${$btnDelete}</div>
			<div class="col-0-5 ve-flex-vh-center">${$padDrag}</div>
		`;
	}
}

export class InitiativeTrackerSettings extends BaseComponent {
	static _PROPS_TRACKED = [
		"isRollInit",
		"isRollHp",
		"playerInitShowExactPlayerHp",
		"playerInitShowExactMonsterHp",
		"playerInitHideNewMonster",
		"playerInitShowOrdinals",
		"statsAddColumns",
		"statsCols",
	];

	constructor ({state}) {
		super();

		this._proxyAssignSimple(
			"state",
			{
				...InitiativeTrackerSettings._PROPS_TRACKED
					.mergeMap(prop => ({[prop]: state[prop]})),
				statsCols: this._getStatColsCollectionFormat(state.statsCols),
			},
		);
	}

	/* -------------------------------------------- */

	// Convert from classic "flat" format to renderable collection format
	_getStatColsCollectionFormat (statsCols) {
		return (statsCols || [])
			.map(data => {
				return InitiativeTrackerStatColumnFactory.fromStateData({data})
					.getAsCollectionRowStateData();
			});
	}

	// Convert from renderable collection format to classic "flat" format
	_getStatColsDataFormat (statsCols) {
		return (statsCols || [])
			.map(data => {
				return InitiativeTrackerStatColumnFactory.fromCollectionRowStateData({data})
					.getAsStateData();
			});
	}

	/* -------------------------------------------- */

	getSettingsUpdate () {
		const out = MiscUtil.copyFast(this._state);
		out.statsCols = this._getStatColsDataFormat(out.statsCols);
		return out;
	}

	/* -------------------------------------------- */

	pGetShowModalResults () {
		const {$modalInner, $modalFooter, pGetResolved, doClose} = UiUtil.getShowModal({
			title: "Settings",
			isUncappedHeight: true,
			hasFooter: true,
		});

		UiUtil.addModalSep($modalInner);
		this._pGetShowModalResults_renderSection_isRolls({$modalInner});
		UiUtil.addModalSep($modalInner);
		this._pGetShowModalResults_renderSection_playerView({$modalInner});
		UiUtil.addModalSep($modalInner);
		this._pGetShowModalResults_renderSection_additionalCols({$modalInner});

		this._pGetShowModalResults_renderFooter({$modalFooter, doClose});

		return pGetResolved();
	}

	/* -------------------------------------------- */

	_pGetShowModalResults_renderSection_isRolls ({$modalInner}) {
		UiUtil.$getAddModalRowCb2({$wrp: $modalInner, comp: this, prop: "isRollInit", text: "Roll initiative"});
		UiUtil.$getAddModalRowCb2({$wrp: $modalInner, comp: this, prop: "isRollHp", text: "Roll hit points"});
	}

	_pGetShowModalResults_renderSection_playerView ({$modalInner}) {
		UiUtil.$getAddModalRowCb2({$wrp: $modalInner, comp: this, prop: "playerInitShowExactPlayerHp", text: "Player View: Show exact player HP"});
		UiUtil.$getAddModalRowCb2({$wrp: $modalInner, comp: this, prop: "playerInitShowExactMonsterHp", text: "Player View: Show exact monster HP"});
		UiUtil.$getAddModalRowCb2({$wrp: $modalInner, comp: this, prop: "playerInitHideNewMonster", text: "Player View: Auto-hide new monsters"});
		UiUtil.$getAddModalRowCb2({$wrp: $modalInner, comp: this, prop: "playerInitShowOrdinals", text: "Player View: Show ordinals", title: "For example, if you add two Goblins, one will be Goblin (1) and the other Goblin (2), rather than having identical names."});
	}

	_pGetShowModalResults_renderSection_additionalCols ({$modalInner}) {
		UiUtil.$getAddModalRowCb2({$wrp: $modalInner, comp: this, prop: "statsAddColumns", text: "Additional Columns"});
		this._pGetShowModalResults_renderSection_additionalCols_head({$modalInner});
		this._pGetShowModalResults_renderSection_additionalCols_body({$modalInner});
	}

	_pGetShowModalResults_renderSection_additionalCols_head ({$modalInner}) {
		const $btnAddRow = $(`<button class="btn btn-default btn-xs bb-0 bbr-0 bbl-0" title="Add"><span class="glyphicon glyphicon-plus"></span></button>`)
			.click(() => this._addStatsCol());

		const $wrpTblStatsHead = $$`<div class="ve-flex-vh-center w-100 mb-2 bb-1p">
			<div class="col-5">Contains</div>
			<div class="col-3">Abbreviation</div>
			<div class="col-1-5 text-center help" title="Only affects creatures. Players are always editable.">Editable</div>
			<div class="col-1-5">&nbsp;</div>
			<div class="col-1 ve-flex-v-center ve-flex-h-right">${$btnAddRow}</div>
		</div>`
			.appendTo($modalInner);

		this._addHookBase("statsAddColumns", () => $wrpTblStatsHead.toggleVe(this._state.statsAddColumns))();
	}

	_pGetShowModalResults_renderSection_additionalCols_body ({$modalInner}) {
		const $wrpRows = $(`<div class="pr-1 h-120p ve-flex-col overflow-y-auto relative"></div>`).appendTo($modalInner);
		this._addHookBase("statsAddColumns", () => $wrpRows.toggleVe(this._state.statsAddColumns))();

		if (!this._state.statsCols.length) this._addStatsCol();

		const renderableCollectionStatsCols = new _RenderableCollectionStatsCols(
			{
				comp: this,
				$wrpRows,
			},
		);

		this._addHookBase("statsCols", () => {
			renderableCollectionStatsCols.render();
		})();
	}

	/* -------------------------------------------- */

	_pGetShowModalResults_renderFooter ({$modalFooter, doClose}) {
		const $btnSave = $(`<button class="btn btn-primary btn-sm w-100">Save</button>`)
			.click(() => doClose(true));

		$$($modalFooter)`<div class="w-100 py-3 no-shrink">
			${$btnSave}
		</div>`;
	}

	/* -------------------------------------------- */

	_addStatsCol () {
		const statsColData = InitiativeTrackerStatColumnFactory.fromNew().getAsCollectionRowStateData();
		this._state.statsCols = [...this._state.statsCols, statsColData];
		return statsColData;
	}
}
