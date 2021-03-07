// INCLUDE FUNCTION FOR HTML (to include header.html & footer.html)

function includeHTML() {
  var z, i, elmnt, file, xhttp;
  /*loop through a collection of all HTML elements:*/
  z = document.getElementsByTagName("*");
  for (i = 0; i < z.length; i++) {
    elmnt = z[i];
    /*search for elements with a certain atrribute:*/
    file = elmnt.getAttribute("w3-include-html");
    if (file) {
      /*make an HTTP request using the attribute value as the file name:*/
      xhttp = new XMLHttpRequest();
      xhttp.onreadystatechange = function() {
        if (this.readyState == 4) {
          if (this.status == 200) {elmnt.innerHTML = this.responseText;}
          if (this.status == 404) {elmnt.innerHTML = "Page not found.";}
          /*remove the attribute, and call this function once more:*/
          elmnt.removeAttribute("w3-include-html");
          includeHTML();
        }
      }      
      xhttp.open("GET", file, true);
      xhttp.send();
      /*exit the function:*/
      return;
    }
  }
};


// JPLAYER SCRIPT


//<![CDATA[

$(document).ready(function(){
  
  // Local copy of jQuery selectors, for performance.
  var	my_jPlayer = $("#jquery_jplayer"),
    my_trackName = $("#jp_container .track-name"),
    my_playState = $("#jp_container .play-state"),
    my_extraPlayInfo = $("#jp_container .extra-play-info");
    
  // Some options
  var	opt_play_first = false, // If true, will attempt to auto-play the default track on page loads. No effect on mobile devices, like iOS.
    opt_auto_play = true, // If true, when a track is selected, it will auto-play.
    opt_text_playing = "Now playing", // Text when playing
    opt_text_selected = "Track selected"; // Text when not playing
    
  // A flag to capture the first track
  var first_track = true;
  
  // Change the time format
  $.jPlayer.timeFormat.padMin = false;
  $.jPlayer.timeFormat.padSec = false;
  $.jPlayer.timeFormat.sepMin = " min ";
  $.jPlayer.timeFormat.sepSec = " sec";
  
  // Initialize the play state text
  my_playState.text(opt_text_selected);
  
  // Instance jPlayer
  my_jPlayer.jPlayer({
    ready: function () {
    	$("#jp_container .track-default").click();
    },
    timeupdate: function(event) {
    	my_extraPlayInfo.text(parseInt(event.jPlayer.status.currentPercentAbsolute, 10) + "%");
    },
    play: function(event) {
    	my_playState.text(opt_text_playing);
    },
    pause: function(event) {
    	my_playState.text(opt_text_selected);
    },
    ended: function(event) {
    	my_playState.text(opt_text_selected);
    },
    swfPath: "jPlayer/dist/jplayer",
    cssSelectorAncestor: "#jp_container",
    supplied: "mp3",
    wmode: "window"
  });
  
  // Create click handlers for the different tracks
    ("#jp_container .track").click(function(e) {
    my_trackName.text($(this).text());
    my_jPlayer.jPlayer("setMedia", {
    	mp3: $(this).attr("href")
    });
    if((opt_play_first && first_track) || (opt_auto_play && !first_track)) {
    	my_jPlayer.jPlayer("play");
    }
    first_track = false;
    $(this).blur();
    return false;
  });

});
//]]>

