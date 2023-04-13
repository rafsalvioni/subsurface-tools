import { app } from './app.js';

function fixTimeZone(diveLog, tz, replace)
{
    let total = 0;
    let count = 0;
    for (const site of diveLog.getSites()) {
        total++;
        if (!replace && site.getTimeZone()) {
            continue;
        }
        site.setTimeZone(tz);
        count++;
    }
    for (const dive of diveLog) {
        total++;
        if (!replace && dive.getTimeZone()) {
            continue;
        }
        if (!dive.isLocalized()) {
            dive.setTimeZone(tz);
            count++;
        }
    }
    return [total, count];
}

function process()
{
    try {
        let diveLog = app.getDiveLog();
        let tz      = prompt('What TZ do you wanna use as default?', Date.SYSTEM_TZ);
        if (!tz) {
            throw 'TZ is required';
        }
        let replace = confirm('Do you want to replace existant TZs?');
        let out = fixTimeZone(diveLog, tz, !!replace);
        alert(`${out[1]}/${out[0]} dive/sites updated!`);
    }
    catch (e) {
        app.error(e);
    }
}

document.getElementById('op-fix-timezones').addEventListener('click', process);
