/* FUNCTIONS FOR FOLDER OPENING/CLOSING */

function setstate(d, i){
    if(d.style.display=='none')
	{
		d.style.display='';
		i.src='images/website/x.png';
	}    else    {
		d.style.display='none';
        i.src='images/website/o.png';
	}
}
