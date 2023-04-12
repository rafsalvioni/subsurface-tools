import { DiveLog } from '../lib/ssrf.js';
import { download } from '../lib/utils.js';

function fixTimeZone(input, tz, replace)
{
    let divelog = new DiveLog(input);
    for (const site of divelog.getSites()) {
        if (!replace && site.getTimeZone()) {
            continue;
        }
        site.setTimeZone(tz);
    }
    for (const dive of divelog) {
        if (!replace && dive.getTimeZone()) {
            continue;
        }
        if (!dive.isLocalized()) {
            dive.setTimeZone(tz);
        }
    }
    return divelog.toString();
}

function process()
{
    let input = document.getElementById('input').value;
    let output;
    try {
        let tz      = prompt('What TZ do you wanna use as default?', Date.SYSTEM_TZ);
        if (!tz) {
            throw 'TZ is required';
        }
        let replace = confirm('Do you want to replace existant TZs?');
        output      = fixTimeZone(input, tz, !!replace);
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
    download(contents, 'dives-tz.ssrf');
});
