import { DiveLog } from '../lib/ssrf.js';
import { app } from './app.js';

function ssrfCompact(input)
{
	var count;
	let total = 0;
    
    // Remove unneeded depth samples...
	let regex = /(<sample time='[^']+' depth='([^']+)'[^>]+>)(\s*<sample time='[^']+' depth='\2' *\/>)+(\s*<sample time='[^']+' depth='\2'[^>]+>)/ig;
	do {
		count = 0;
		input = input.replaceAll(regex, function()
		{
			count   += Array.from(arguments[0].matchAll(/<sample/g)).length - 2;
			let ret = arguments[1] + '<!-- Cleaned -->' + arguments[4];
			return ret;
		});
		total += count;
	} while (count > 0);
	
    // Remove unneeded depth 0.0 on dive end
	regex = /(<sample time='[^']+' depth='0\.0 m'[^>]+>)(\s*<sample time='[^']+' depth='0\.[^']+'[^>]+>)+(\s*<\/divecomputer>)/ig;
	do {
		count = 0;
		input = input.replaceAll(regex, function()
		{
			count   += Array.from(arguments[0].matchAll(/<sample/g)).length - 1;
			let ret = arguments[1] + '<!-- Cleaned -->' + arguments[3];
			return ret;
		});
		total += count;
	} while (count > 0);
    
    // Finallizing...
	if (total > 0) {
		alert(`${total} sample(s) removed!`);
	}
	else {
		alert('Nothing to do...');
	}
	
	return input;
}

function process()
{
	let diveLog = app.getDiveLog();
	let output;
	try {
		output  = ssrfCompact(diveLog.toString());
		diveLog = new DiveLog(output);
	}
	catch (e) {
		app.error(e);
	}
}

document.getElementById('op-ssrf-compact').addEventListener('click', process);
