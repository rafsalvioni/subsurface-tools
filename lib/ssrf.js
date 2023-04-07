import { Point } from './geo.js';
import { Interpolator } from './interpolator.js';
import './proto.js';

/**
 * Default pressure at sea level, in bar
 * 
 */
const DEFAULT_PRESSURE = 1.013;
/**
 * TimeZone Regex
 * 
 */
const TZ_REGEX = /^([+-]?\d{2}:?\d{2}|GMT|UTC)/i;

/**
 * Converts a pressure to meters.
 * 
 * @param {number} bar Pressure, in bars
 * @returns number
 */
function barToMeters(bar)
{
    return Math.rounds(Math.log10(DEFAULT_PRESSURE / bar) * 7800, 1); // see 3
}

/**
 * Converts a time string (ie 000:?00) to integer
 * 
 * @param {string} time 
 * @returns number
 */
function timeToInt(time)
{
    let m;
    if (m = time.match(/^([+-]?\d+):?(\d{1,2})/)) {
        return parseInt(m[1]) * 60 + parseInt(m[2]);
    }
    return 0;
}

/**
 * Converts a numeric string with measure unit (ie '1.23 m') to a number.
 * 
 * @param {string} n 
 * @returns number
 */
function toNumber(n)
{
    let m;
    if (m = n.match(/^(\d+(?:\.\d+)?)/)) {
        return parseFloat(m[1]);
    }
    return 0;
}

/**
 * Represents a Subsurface XML
 * 
 */
export class DiveLog
{
    #root;
    #sites;
    #tz;

    /**
     * 
     * @param {string} ssrfString SSRF XML string
     */
    constructor(ssrfString)
    {
        let doc = (new DOMParser()).parseFromString(ssrfString, "text/xml");
        if (doc.childNodes.length == 1) {
            switch (doc.childNodes[0].tagName) {
                case 'divesites':
                    this.#root  = doc.childNodes[0];
                    this.#sites = new DiveSites(doc.childNodes[0]);
                    break;
                case 'divelog':
                    this.#root  = doc.childNodes[0];
                    this.#sites = new DiveSites(doc.getElementsByTagName('divesites')[0]);
                    break;
                default:
                    throw 'Invalid Subsurface XML';
            }
        }
        else {
            throw 'Invalid Subsurface XML';
        }
        this.defaultTZ = Date.SYSTEM_TZ;
    }

    /**
     * Sets DiveLog's default TimeZone
     * 
     * It is initialized with System TimeZone
     * 
     */
    set defaultTZ(tz)
    {
        if (TZ_REGEX.test(tz)) {
            this.#tz = tz;
        }
        else {
            throw `Invalid TZ offset ${tz}`;
        }
    }

    /**
     * Returns DiveLog's default TimeZone
     * 
     * @returns string
     */
    get defaultTZ()
    {
        return this.#tz ?? 'GMT';
    }
    
    /**
     * 
     * @param {Date} dt 
     * @returns object|null
     */
    getSampleAt(dt)
    {
        for (const dive of this) {
            let s = dive.getSampleAt(dt);
            if (s) {
                return s;
            }
        }
        return null;
    }

    /**
     * Returns the Dive did at instant given, or null.
     * 
     * @param {Date} dt 
     * @returns Dive
     */
    getDiveAt(dt)
    {
        for (const dive of this) {
            let s = dive.getSampleAt(dt);
            if (s) {
                return dive;
            }
        }
        return null;
    }
    
    /**
     * 
     * @returns Dive
     */
    *[Symbol.iterator]()
    {
        let dives = this.#root.getElementsByTagName('dive');
        for (const el of dives) {
            yield new Dive(this, el);
        }
    }

    /**
     * Returns DiveSites manager.
     * 
     * @returns DiveSites
     */
    getSites()
    {
        return this.#sites;
    }

    /**
     * Serializes object to XML
     * 
     * @returns string
     */
    toString()
    {
        return (new XMLSerializer()).serializeToString(this.#root);
    }
}

/**
 * Represents a DiveSite repository
 * 
 */
class DiveSites
{
    #root;

    /**
     * 
     * @param {DOMElement} el Element "divesites"
     */
    constructor(el)
    {
        this.#root = el;
    }

    /**
     * Divesite iterator
     * 
     * @return object
     */
    *[Symbol.iterator]()
    {
        let sites = this.#root.getElementsByTagName('site');
        for (const el of sites) {
            yield this.constructor.#elToSite(el);
        }
    }

    /**
     * Defines a GPS position in a site wihout localization.
     * 
     * @param {string} uuid 
     * @param {Point} point 
     * @param {bool} force Forces define even site have GPS
     * @returns bool
     */
    setPosition(uuid, point, force=false)
    {
        let site = document.evaluate(`*[local-name()='site' and @uuid='${uuid}']`, this.#root).iterateNext();
        if (site && (!site.hasAttribute('gps') || force)) {
            site.setAttribute('gps', point.coords);
            return true;
        }
        return false;
    }

    /**
     * Returns a site by its UUID.
     * 
     * @param {string} uuid 
     * @returns object|null
     */
    getByUuid(uuid)
    {
        let site = document.evaluate(`*[local-name()='site' and @uuid='${uuid}']`, this.#root).iterateNext();
        if (site) {
            return this.constructor.#elToSite(site);
        }
        return null;
    }

    /**
     * Returns a site by a position given.
     * 
     * Will be considered all sites around 100 m of point given. The nearest site of them will be returned.
     * 
     * @param {Point} point 
     * @param {bool} create Create if not found?
     * @returns object|null
     */
    getByPosition(point, create=false)
    {
        let sites = this.#getSitesAround(point, 3); // Lets search sites near point (~100 m)
        let el    = sites.iterateNext(); // Found one?

        if (!el && create) { // If not found, create?
            return this.#createSite(point);
        }

        let dist  = 200;
        let nearest;
        do { // Lets refine... We are going to choose the nearest site
            let site = this.constructor.#elToSite(el);
            if (!site.point) {
                continue;
            }
            let d = point.distanceTo(site.point);
            if (d < dist) {
                dist    = d;
                nearest = site;
                if (d == 0) { // No distance? We found the exact point!
                    break;
                }
            }
        } while (el = sites.iterateNext());
        return nearest;
    }

    /**
     * 
     * @param {DOMElement} el 
     */
    static #elToSite(el)
    {
        let gps = el.getAttribute('gps');
        let ret = {uuid: el.getAttribute('uuid').trim()}
        if (gps) {
            let coords     = gps.trim().split(/ +/);
            ret.point      = new Point(parseFloat(coords[0]), parseFloat(coords[1]));
            let name       = el.getAttribute('name');
            ret.point.name = name ?? gps.trim();
        }
        return ret;
    }

    /**
     * Search sites near given point.
     * 
     * Each precision level decreases search radix ~1/10.
     * 
     * P = 0, Radix ~ 100 km
     * P = 1, Radix ~ 10 km
     * p = 2, Radix ~ 1 km
     * p = 3, Radix ~ 100 m
     * p = 4, Radix ~ 10 m
     * 
     * @param {Point} point 
     * @param {int} p Precision
     * @returns XPathResult
     */
    #getSitesAround(point, p=3)
    {
        let pow = Math.pow(10, p);
        let lat = parseInt(point.lat * pow) / pow;
        let lon = parseInt(point.lon * pow) / pow;
        let res = document.evaluate(
            `*[local-name()='site' and starts-with(@gps,'${lat}') and contains(@gps,' ${lon}')]`,
            this.#root
        );
        return res;
    }

    /**
     * 
     * @param {Point} point 
     * @returns object
     */
    #createSite(point)
    {
        let el   = document.createElement('site');
        let name = point.desc;
        let desc = '## Created by subsurface-tools ##';
        let hash = String(Math.abs((name + desc).hash()));
        let uuid = hash.toString(16).substring(0, 8);
        el.setAttribute('uuid', uuid);
        el.setAttribute('name', name);
        el.setAttribute('gps', point.coords);
        el.appendChild(document.createElement('notes'));
        el.firstChild.textContent = desc;
        this.#root.appendChild(el);
        return {
            uuid: uuid, point: point
        }
    }
}

/**
 * Represents a Dive
 * 
 */
class Dive
{
    #root;
    #diveLog
    #samples;
    #site;
    #tz;
    #num;

    /**
     * 
     * @param {DiveLog} diveLog 
     * @param {DOMElement} el Element "dive" 
     */
    constructor(diveLog, el)
    {
        this.#diveLog = diveLog;
        this.#root    = el;
        this.#samples = new Interpolator('time');

        if (el.hasAttribute('divesiteid')) { // Is there a site?
            let uuid   = el.getAttribute('divesiteid');
            this.#site = diveLog.getSites().getByUuid(uuid);
            if (!this.#site) { // Site not found... Remove link
                el.removeAttribute('divesiteid');
            }
        }
        this.#num = parseInt(this.#root.getAttribute('number'));
        this.#loadTZ();
    }

    /**
     * Returns dive's number.
     * 
     * @returns int
     */
    getNum()
    {
        return this.#num;
    }

    /**
     * Returns the dive's start date/time.
     * 
     * @see DiveLog.defaultTZ
     * @returns Date
     */
    getStart()
    {
        let date = this.#root.getAttribute('date');
        let time = this.#root.getAttribute('time');
        let str  = `${date} ${time} ${this.#tz}`;
        return Date.create(str.trim());
    }

    /**
     * Returns the dive's end date/time.
     * 
     * @returns Date
     */
    getEnd()
    {
        let start = this.getStart();
        let dur   = this.getDuration() * 1000;
        return new Date(start.getTime() + dur);
    }

    /**
     * Returns the dive's duration, in seconds.
     * 
     * @returns int
     */
    getDuration()
    {
        let time = this.#root.getAttribute('duration');
        return timeToInt(time);
    }

    /**
     * Returns dive's depths, max and mean.
     * 
     * @returns object
     */
    getDepth()
    {
        // We are check all DCs stored
        let depth = document.evaluate('divecomputer/depth', this.#root);
        let el;
        let ret = {max: 0, mean: 0};
        while (el = depth.iterateNext()) {
            ret.max  = Math.max(ret.max, toNumber(el.getAttribute('max')));
            ret.mean = Math.max(ret.mean, toNumber(el.getAttribute('mean')));
        }
        return ret;
    }

    /**
     * Returns a dive's DC sample at date/time given.
     * 
     * @param {Date} dt 
     * @returns object|null
     */
    getSampleAt(dt)
    {
        this.#loadSamples();
        let start = this.getStart().getTimeSeconds();
        let dur   = this.getDuration();
        let ts    = dt.getTimeSeconds();
        let time  = ts - start;
        let s;
        if (
            time >= 0 && time <= dur // Only intervals inside Dive
            && (s = this.#samples.sampleAt(time))
        ) {
            delete(s._sel_);
            return s;
        }
        return null;
    }

    /**
     * Returns the dive's start spot.
     * 
     * Lat and Lon are given by divesite. Altitude is given by airpressure.
     * 
     * @returns Point
     */
    getSpot()
    {
        if (!this.isLocalized()) {
            return null;
        }
        let alt = 0;
        let bar;

        let tmp;
        if (this.#root.hasAttribute('airpressure')) { // Is there a pressure given by user?
            bar = toNumber(this.#root.getAttribute('airpressure'));
        }
        // No... Lets check main DC...
        else if (tmp = document.evaluate('divecomputer[1]/surface[@pressure]', this.#root).iterateNext()) {
            bar = toNumber(tmp.getAttribute('pressure'));
        }
        else { // Noop...
            bar = 1;
        }

        alt = Math.max(alt, barToMeters(bar));
        let point = Object.assign(new Point(0,0), this.#site.point, {alt: alt});
        return point;
    }

    /**
     * Defines the dive spot.
     * 
     * If dive have a site without GPS, it will be defined.
     * If position refers a existant divesite (or near one), it will be used.
     * Otherwise, a new divesite will be created.
     * 
     * @param {Point} point 
     * @returns Dive
     */
    setSpot(point)
    {
        if (
            this.#site && !this.#site.point && // Site without GPS
            this.#diveLog.getSites().setPosition(this.#site.uuid, point) // Lets update it!
        ) {
            return this;
        }

        let site = this.#diveLog.getSites().getByPosition(point, true);
        this.#root.setAttribute('divesiteid', site.uuid);
        return this;
    }

    /**
     * Returns the divesite reference, if is there one.
     * 
     * @returns object
     */
    getSite()
    {
        return this.#site;
    }

    /**
     * Returns if dive have a GPS localization.
     * 
     * @returns bool
     */
    isLocalized()
    {
        return this.#site && this.#site.point;
    }

    /**
     * Loads DC samples on Interpolator
     * 
     */
    #loadSamples()
    {
        if (!this.#samples.isEmpty()) {
            return;
        }
        // Load samples from main DC
        let samples = document.evaluate(
            'divecomputer[1]/sample', this.#root, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE
        );
        let el, last;
        while (el = samples.iterateNext()) {
            let s = this.constructor.#sampleToObj(el);
            if (last) {
                s = Object.assign(last, s);
            }
            last = Object.clone(s);
            this.#samples.add(s);
        }
    }

    /**
     * Loads dive's TimeZone.
     * 
     * By default, dive isnt have TimeZone. So we a use a trick: a special text #tz:????.
     * 
     * It could be in 2 places: in dive's tags or in dive's site notes. Where found first, it will be used.
     * Else, the system's TZ.
     * 
     */
    #loadTZ()
    {
        let regex = /#tz:([+-]?[A-Z\d]+)/i
        let tags = this.#root.getAttribute('tags');
        let m;
        let tz;

        if (m = tags.match(regex)) { // Lets try in Dive's tags
            tz = m[1];
            this.#writeLog(`using own TZ ${tz}`);
        }
        else if (this.#site) { // Noop... Is there a site?
            let xp = document.evaluate(
                `//*[local-name()='site' and @uuid='${this.#site.uuid}']/*[local-name()='notes']`, this.#root
            );
            let el = xp.iterateNext();
            if (el && (m = el.textContent.match(regex))) { // Is there TZ in site's notes?
                tz = m[1];
                this.#writeLog(`using site's TZ ${tz}`);
            }
        }
        if (tz && !TZ_REGEX.test(tz)) { // Testing TZ validity...
            throw `Invalid dive TZ: ${tz}`;
        }
        else if (!tz) { // No TZ found... Lets use default DiveLog TZ
            tz = this.#diveLog.defaultTZ;
            this.#writeLog(`using default TZ ${tz}`);
        }
        this.#tz = tz;
    }

    /**
     * Writes in console log
     * 
     * @param {string} m 
     */
    #writeLog(m)
    {
        console.log(`Dive #${this.#num}: ${m}`);
    }

    /**
     * Converts a sample to a object.
     * 
     * @param {DOMElement} el Element 'sample'
     * @returns object
     */
    static #sampleToObj(el)
    {
        if (!el.hasAttribute('time') || !el.hasAttribute('depth')) {
            return null
        }
        let s = {
            'time':  timeToInt(el.getAttribute('time')),
            'depth': toNumber(el.getAttribute('depth'))
        }
        if (el.hasAttribute('temp')) {
            s.temp = toNumber(el.getAttribute('temp'));
        }
        if (el.hasAttribute('heartbeat')) {
            s.heart = toNumber(el.hasAttribute('heartbeat'));
        }
        return s;
    }
}