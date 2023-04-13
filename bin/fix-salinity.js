import { app } from "./app.js";

function process()
{
	try {
		let divelog = app.getDiveLog()
        let stats   = divelog.fixSaltSalinity();
		if (stats[0] == 0) {
			throw `No DCs match`;
		}
        alert(`${stats[1]}/${stats[0]} DCs data updated!`);
	}
	catch (e) {
		app.error(e);
	}
}

document.getElementById('op-fix-salinity').addEventListener('click', process);
