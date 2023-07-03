export class InitiativeTrackerDataSerializerBase {
	static _FIELD_MAPPINGS = {};

	static fromSerial (dataSerial) {
		return Object.entries(this._FIELD_MAPPINGS)
			.filter(([, kSerial]) => dataSerial[kSerial] != null)
			.mergeMap(([kFull, kSerial]) => ({[kFull]: dataSerial[kSerial]}));
	}

	static toSerial (data) {
		return Object.entries(this._FIELD_MAPPINGS)
			.filter(([kFull]) => data[kFull] != null)
			.mergeMap(([kFull, kSerial]) => ({[kSerial]: data[kFull]}));
	}
}
