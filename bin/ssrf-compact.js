import { download } from '../lib/utils.js';

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
	let input = document.getElementById('input').value;
	let output;
	try {
		output = ssrfCompact(input);
	}
	catch (e) {
		output = `ERROR: ${e}`;
	}
	document.getElementById('output').value = output;
}

document.getElementById('input').addEventListener('change', process);
document.getElementById('redo').addEventListener('click', process);
document.getElementById('download').addEventListener('click', () => {
	let contents = document.getElementById('output').value;
	download(contents, 'dives-compact.ssrf');
});
