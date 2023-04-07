
/**
 * 
 * @param {number} deg 
 * @returns float
 */
Math.toRadians = function(deg)
{
    return deg * (Math.PI / 180);
};

/**
 * 
 * @param {number} rad 
 * @returns float
 */
Math.toDegree = function(rad)
{
    return rad * (180 / Math.PI);
}

/**
 * Rounds a number to nearest number using scale.
 * 
 * @param {number} n number
 * @param {int} s scale
 * @returns number
 */
Math.rounds = function(n, s)
{
    return Number(n.toFixed(s));
}

String.prototype.format = String.prototype.format ||
function () {
    "use strict";
    var str = this.toString();
    if (arguments.length) {
        var t = typeof arguments[0];
        var key;
        var args = ("string" === t || "number" === t) ?
            Array.prototype.slice.call(arguments)
            : arguments[0];

        for (key in args) {
            str = str.replace(new RegExp("\\{" + key + "\\}", "gi"), args[key]);
        }
    }

    return str;
};

String.prototype.hash = String.prototype.hash ||
function() {
    var hash = 0;
    if (this.length == 0) return hash;
    for (let x = 0; x < this.length; x++) {
        let ch = this.charCodeAt(x);
        hash = ((hash <<5) - hash) + ch;
        hash = hash & hash;
    }
    return hash;
}

String.prototype.entitiesEncode = String.prototype.entitiesEncode ||
function() {
    return this.replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

String.prototype.entitiesDecode = String.prototype.entitiesDecode ||
function() {
    return this.replace(/&apos;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&gt;/g, '>')
        .replace(/&lt;/g, '<')
        .replace(/&amp;/g, '&');
}

Date.prototype.getTimeSeconds = Date.prototype.getTimeSeconds ||
function () {
    "use strict";
    return parseInt(this.getTime() / 1000);
};

Date.create = Date.create ||
function (v) {
    let dt = new Date(v);
    if (dt instanceof Date && !isNaN(dt.getTime())) {
        return dt;
    }
    throw `Invalid date value '${v}'`;
};

Date.SYSTEM_TZ = (function()
{
    let offset = (new Date()).getTimezoneOffset();
    if (offset == 0) {
        return 'GMT';
    }
    let s = offset < 0 ? '+' : '-';
    offset = Math.abs(offset);
    let m = (offset % 60);
    let h = (offset - m) / 60;
    m = String(m).padStart(2, '0');
    h = String(h).padStart(2, '0');
    return `${s}${h}${m}`;
})();

Object.clone = Object.prototype.clone ||
function(obj) {
    return Object.assign({}, obj);
};
