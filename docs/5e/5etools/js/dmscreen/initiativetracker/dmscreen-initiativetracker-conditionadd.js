export class InitiativeTrackerConditionAdd {
	async pGetShowModalResults () {
		const {$modalInner, doClose, pGetResolved} = UiUtil.getShowModal({isMinHeight0: true});

		const $wrpRows = $(`<div class="dm-init__modal-wrp-rows"></div>`).appendTo($modalInner);

		const conds = InitiativeTrackerUtil.CONDITIONS;
		for (let i = 0; i < conds.length; i += 3) {
			const $row = $(`<div class="ve-flex-v-center mb-2"></div>`).appendTo($wrpRows);
			const populateCol = (cond) => {
				const $col = $(`<div class="col-4 text-center"></div>`).appendTo($row);
				if (cond) {
					$(`<button class="btn btn-default btn-xs dm-init__btn-cond" style="background-color: ${cond.color} !important;">${cond.name}</button>`).appendTo($col).click(() => {
						$iptName.val(cond.name);
						$iptColor.val(cond.color);
					});
				}
			};
			[conds[i], conds[i + 1], conds[i + 2]].forEach(populateCol);
		}

		$wrpRows.append(`<hr>`);

		$(`<div class="ve-flex-v-center mb-2">
			<div class="col-5 pr-2">Name (optional)</div>
			<div class="col-2 text-center">Color</div>
			<div class="col-5 pl-2">Duration (optional)</div>
		</div>`).appendTo($wrpRows);
		const $controls = $(`<div class="ve-flex-v-center mb-2"></div>`).appendTo($wrpRows);
		const [$wrpName, $wrpColor, $wrpTurns] = ["pr-2", "", "pl-2"].map(it => $(`<div class="col-${it ? 5 : 2} ${it} text-center"></div>`).appendTo($controls));
		const $iptName = $(`<input class="form-control">`)
			.on("keydown", (e) => {
				if (e.which === 13) $btnAdd.click();
			})
			.appendTo($wrpName);
		const $iptColor = $(`<input class="form-control" type="color" value="${MiscUtil.randomColor()}">`).appendTo($wrpColor);
		const $iptTurns = $(`<input class="form-control" type="number" step="1" min="1" placeholder="Unlimited">`)
			.on("keydown", (e) => {
				if (e.which === 13) $btnAdd.click();
			})
			.appendTo($wrpTurns);
		const $wrpAdd = $(`<div class="ve-flex-v-center">`).appendTo($wrpRows);

		const $btnAdd = $(`<button class="btn btn-primary">Set Condition</button>`)
			.click(() => {
				doClose(
					true,
					UtilConditions.getDefaultState({
						name: $iptName.val().trim(),
						color: $iptColor.val(),
						turns: $iptTurns.val(),
					}),
				);
				doClose();
			});

		$$`<div class="col-12 text-center">${$btnAdd}</div>`.appendTo($wrpAdd);

		return pGetResolved();
	}
}
