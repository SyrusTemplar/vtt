var fb = self.fb || {};

fb.fbOptions = {

/*
See the instructions for information about setting floatbox options.
See the options reference for details about all the available options.
*/

global: {
	activateMedia: false,
	autoGallery: false
},

mobile: {
	showControlsText: false,
	showItemNumber: false,
	showPrint: false,
	numIndexLinks: 0,
	strictCentering: false,
	padding: 12,
	panelPadding: 4,
	navType: 'button',
	imageTransition: 'slide',
	preloadLimit: 1
},

type: {
	image: {},
	video: {},
	html: {},
	// html settings apply to all 5 html sub-types that follow
	iframe: {},
	inline: {},
	ajax: {},
	direct: {},
	pdf: {
		mobile: { newWindow: true }
	}
},

className: {
	modern: {
		colorTheme: 'silver',
		innerBorderColor: '#ccc',
		outerBorderColor: '#eee',
		innerBorder: 0,
		outerBorder: 6,
		padding: 0,
		panelPadding: 4,
		boxCornerRadius: 0,
		shadowType: 'hybrid',
		navType: 'overlay',
		captionPos: 'tc',
		caption2Pos: 'tc',
		infoLinkPos: 'tc',
		printLinkPos: 'tc',
		itemNumberPos: 'tl',
		newWindowLinkPos: 'tr',
		indexPos: 'tl',
		controlsPos: 'tr',
		overlayFadeTime: 0.3,
		resizeTime: 0.4,
		transitionTime: 0.5
	},
	transparent: {
		boxColor: 'transparent',
		contentBackgroundColor: 'transparent',
		shadowType: 'none',
		overlayOpacity: 0.75,
		captionPos: 'tc',
		controlsPos: 'tr',
		enableImageResize: false,
		outerBorder: 0,
		innerBorder: 0,
		zoomBorder: 0
	},
	naked: {
		boxCornerRadius: 0,
		showOuterClose: true,
		showClose: false,
		inFrameResize: false,
		showItemNumber: false,
		navType: 'overlay',
		showNavOverlay: true,
		caption: null,
		outerBorder: 0,
		innerBorder: 0,
		zoomBorder: 0,
		padding: 0,
		panelPadding: 0
	},
	fbInfo: {	// applies to boxes opened from Info... links
		boxCornerRadius: 6,
		shadowSize: 8,
		padding: 18,
		overlayOpacity: 0.45,
		resizeTime: 0.3,
		fadeTime: 0,
		transitionTime: 0.3,
		overlayFadeTime: 0.3
	},
	fbTooltip: {	// tooltip options
	},
	fbContext: {	// contextBox options
	}
}
};
