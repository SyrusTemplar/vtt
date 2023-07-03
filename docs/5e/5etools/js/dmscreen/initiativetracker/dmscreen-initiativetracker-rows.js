import {InitiativeTrackerDataSerializerBase} from "./dmscreen-initiativetracker-util.js";

class _InitiativeTrackerRowNameMetaDataSerializer extends InitiativeTrackerDataSerializerBase {
	static _FIELD_MAPPINGS = {
		"name": "n",
		"displayName": "d",
		"scaledCr": "scr",
		"scaledSummonSpellLevel": "ssp",
		"scaledSummonClassLevel": "scl",

		// region Used by player tracker
		"customName": "m",
		// endregion
	};
}

class _InitiativeTrackerRowStatsColDataSerializer extends InitiativeTrackerDataSerializerBase {
	static _FIELD_MAPPINGS = {
		"id": "id",
		"value": "v",
	};
}

export class InitiativeTrackerRowDataSerializer extends InitiativeTrackerDataSerializerBase {
	static _FIELD_MAPPINGS = {
		"hpCurrent": "h",
		"hpMax": "g",
		"initiative": "i",
		"isActive": "a",
		"source": "s",
		"conditions": "c",
		"isPlayerVisible": "v",

		// region Used by player tracker
		"hpWoundLevel": "hh",
		"ordinal": "o",
		// endregion
	};

	static fromSerial (dataSerial) {
		const out = super.fromSerial(dataSerial);

		out.nameMeta = _InitiativeTrackerRowNameMetaDataSerializer.fromSerial(
			// Handle legacy data format
			dataSerial.n instanceof Object
				? dataSerial.n
				: {n: dataSerial.n},
		);
		out.rowStatColData = (dataSerial.k || [])
			.map(rowStatColData => _InitiativeTrackerRowStatsColDataSerializer.fromSerial(rowStatColData));

		// Convert legacy data
		if (out.conditions) {
			out.conditions = out.conditions
				.map(cond => {
					if (cond.id) return cond;
					return {
						id: CryptUtil.uid(),
						entity: {
							...cond,
						},
					};
				});
		}

		return out;
	}

	static toSerial (data) {
		const out = super.toSerial(data);

		out.n = _InitiativeTrackerRowNameMetaDataSerializer.toSerial(data.nameMeta);
		out.k = (data.rowStatColData || [])
			.map(rowStatColData => _InitiativeTrackerRowStatsColDataSerializer.toSerial(rowStatColData));

		return out;
	}
}
