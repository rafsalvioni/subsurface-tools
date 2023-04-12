import { Point } from './geo.js';
import { Interpolator } from './interpolator.js';
import './proto.js';
import { domToStruct, objToXml } from './utils.js';

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
 * TZ Tag Regex
 * 
 */
const TZTAG_REGEX = /#tz:([+-]?\d{2}:?\d{2}|GMT|UTC)/i
/**
 * Default salt water salinity
 * 
 */
const SALT_SALINITY = '1030 g/l';

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
                    this.#sites = new DiveSites(doc.childNodes[0], this);
                    break;
                case 'divelog':
                    this.#root  = doc.childNodes[0];
                    let sites   = document.evaluate('divesites[1]', this.#root).iterateNext();
                    if (!sites) {
                        sites = document.createElement('divesites');
                        this.#root.appendChild(sites);
                    }
                    this.#sites = new DiveSites(sites, this);
                    break;
                default:
                    throw 'Invalid Subsurface XML: Unknown root node';
            }
        }
        else {
            throw 'Invalid Subsurface XML: No root node';
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
     * Returns data at instant given, or null.
     * 
     * Returns {sample, dive}
     * 
     * @param {Date} dt 
     * @returns object
     */
    getDataAt(dt)
    {
        let date  = dt.toISOString().substring(0, 10);
        // Get just dives on date given... (Can be a issue with TZ...)
        let dives = document.evaluate(
            `//dive[@date='${date}']`, this.#root,
            null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE
        );
        for (let i = 0; i < dives.snapshotLength; i++) {
            let el   = dives.snapshotItem(i);
            let dive = new Dive(this, el);
            let s    = dive.getSampleAt(dt);
            if (s) {
                return {
                    sample: s, dive: dive
                };
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
     * Adds salt salinity in all DCs downloaded data that dont have one.
     * 
     * Returns DCs amount found / changed.
     * 
     * @returns int[2]
     */
    fixSaltSalinity()
    {
        // Get all "downloaded" DCs data
        let dcs   = document.evaluate(
            `//divecomputer[@deviceid]`, this.#root,
            null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE
        );
        let count = 0;
        for (let i = 0; i < dcs.snapshotLength; i++) {
            let dc = dcs.snapshotItem(i);
            if (document.evaluate("water", dc).iterateNext()) {
                console.log(`DC#${i} has water element`);
                continue; // DC have a water... continue
            }
            dc.innerHTML += objToXml({'@salinity': SALT_SALINITY}, 'water');
            count++;
        }
        return [dcs.snapshotLength, count];
    }

    /**
     * Adds a Serial extradata to all DCs data that dont have one.
     *
     * Uses SSRF fingerprint deviceid to find serial number.
     * 
     * Returns DCs amount found / changed.
     * 
     * @returns int[2]
     */
    fixDCSerial()
    {
        // Get all DCs data from given model
        let dcs     = document.evaluate(
            '//divecomputer[@deviceid]', this.#root,
            null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE
        );
        let count   = 0;
        let devices = this.#loadDevices();
        for (let i = 0; i < dcs.snapshotLength; i++) {
            let dc = dcs.snapshotItem(i);
            if (document.evaluate("extradata[@key='Serial']", dc).iterateNext()) {
                console.log(`DC#${i} has a serial`);
                continue; // DC has a serial... continue
            }
            let deviceid = dc.getAttribute('deviceid');
            if (!devices[deviceid]) {
                console.log(`DC#${i}: Device not found`);
                continue;
            }
            dc.innerHTML += objToXml({'@key': 'Serial', '@value': devices[deviceid]}, 'extradata');
            count++;
        }
        return [dcs.snapshotLength, count];
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
    
    /**
     * Loads DCs from settings/fingerprint
     * 
     * @returns object
     */
    #loadDevices()
    {
        let devices = document.evaluate(`settings/fingerprint[@deviceid]`, this.#root);
        let d;
        let ret  = {};
        while (d = devices.iterateNext()) {
            let id     = d.getAttribute('deviceid');
            let serial = d.getAttribute('serial');
            if (serial) {
                ret[id] = parseInt(serial, 16);
            }
        }
        return ret;
    }
}

/**
 * Represents a DiveSite repository
 * 
 */
class DiveSites
{
    #root;
    #diveLog;

    /**
     * 
     * @param {DOMElement} el Element "divesites"
     * @param {DiveLog} diveLog
     */
    constructor(el, diveLog)
    {
        this.#root    = el;
        this.#diveLog = diveLog;
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
            yield new DiveSite(el, this.#diveLog);
        }
    }

    /**
     * Returns a site by its UUID.
     * 
     * @param {string} uuid 
     * @returns DiveSite
     */
    getByUuid(uuid)
    {
        let site = this.#loadSite(uuid);
        if (site) {
            return new DiveSite(site, this.#diveLog);
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
     * @returns DiveSite
     */
    getByPosition(point, create=false)
    {
        let sites = this.#getSitesAround(point, 3); // Lets search sites near point (~100 m)
        if (sites.snapshotLength == 0 && create) { // If not found, create?
            return this.#createSite(point);
        }

        let dist  = 200;
        let nearest;
        for (let i = 0; i < sites.snapshotLength; i++) { // Lets refine... We are going to choose the nearest site
            let el   = sites.snapshotItem(i);
            let site = new DiveSite(el, this.#diveLog);
            let d    = point.distanceTo(site.getPoint());
            if (d < dist) {
                dist    = d;
                nearest = site;
                if (d == 0) { // No distance? We found the exact point!
                    break;
                }
            }
        };
        return nearest;
    }

    /**
     * Loads a site element using its uuid, or null.
     * 
     * @param {string} uuid UUID
     * @returns DOMElement
     */
    #loadSite(uuid)
    {
        return document.evaluate(
            `*[local-name()='site' and @uuid='${uuid}']`, this.#root,
            null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE
        ).snapshotItem(0);
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
            this.#root, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE
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
        let name = point.desc;
        let desc = '## Created by subsurface-tools ##';
        let hash = Math.abs((name + desc).hash()); // UUID is done using SHA1, but it is too heavy...
        let uuid = hash.toString(16).substring(0, 8).padStart(8, '0');
        let el = {
            '@uuid': uuid, '@name': name, '@gps': point.coords,
            notes: desc
        };
        let xml = objToXml(el, 'site');
        this.#root.innerHTML += xml;
        return this.getByUuid(uuid);
    }
}

/**
 * Represents a Dive Site.
 * 
 */
class DiveSite
{
    #root;
    #diveLog;

    /**
     * 
     * @param {DOMElement} el Element "site" 
     * @param {DiveLog} divelog 
     */
    constructor(el, divelog)
    {
        this.#root    = el;
        this.#diveLog = divelog;
    }

    /**
     * Defines a GPS position.
     * 
     * @param {Point} point 
     * @param {bool} force Forces define even site have GPS
     * @returns bool
     */
    setPoint(point, force=false)
    {
        if (!this.isLocalized() || force) {
            this.#root.setAttribute('gps', point.coords);
            return true;
        }
        return false;
    }

    /**
     * Define site's TimeZone
     * 
     * @param {string} tz 
     * @returns DiveSite
     */
    setTimeZone(tz)
    {
        if (tz && !TZ_REGEX.test(tz)) {
            throw `Invalid tz: ${tz}`;
        }
        let tzTag = tz ? `#tz:${tz}` : '';
        let notes = this.getNotes();
        if (notes) {
            notes = notes.replace(TZTAG_REGEX, '').trim();
            notes += ` ${tzTag}`;
            this.#root.innerHTML = this.#root.innerHTML
                .replace(/<notes>.+?<\/notes>(\r?\n)?/i, objToXml(notes.trim(), 'notes'));
        }
        else if (tzTag) {
            this.#root.innerHTML += objToXml(tzTag, 'notes');
        }
        return this;
    }

    /**
     * Returns site's timezone
     * 
     * @returns string
     */
    getTimeZone()
    {
        let notes = this.getNotes();
        let m;
        if (notes && (m = notes.match(TZTAG_REGEX))) {
            return m[1];
        }
        return null;
    }

    /**
     * Returns site's GPS point, or null.
     * 
     * @returns Point
     */
    getPoint()
    {
        let gps;
        if (gps = this.#root.getAttribute('gps')) {
            gps        = gps.trim().split(/ +/);
            let point  = new Point(parseFloat(gps[0]), parseFloat(gps[1]));
            point.name = this.getName();
            return point;
        }
        return null;
    }

    /**
     * Return site's notes.
     * 
     * @returns string
     */
    getNotes()
    {
        let notes;
        if (notes = document.evaluate('notes/text()', this.#root).iterateNext()) {
            return notes.nodeValue;
        }
        return null;
    }

    /**
     * Return site's name.
     * 
     * @returns string
     */
    getName()
    {
        return this.#root.getAttribute('name');
    }

    /**
     * Returns site's UUID
     * 
     * @returns string
     */
    getUuid()
    {
        return this.#root.getAttribute('uuid');
    }

    /**
     * Check if site has GPS position, ie. if it is localized.
     * 
     * @returns bool
     */
    isLocalized()
    {
        return this.#root.hasAttribute('gps');
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
    #cache = {};

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
        this.#cache.num = parseInt(this.#root.getAttribute('number'));
    }

    /**
     * Returns dive's number.
     * 
     * @returns int
     */
    getNum()
    {
        return this.#cache.num;
    }

    /**
     * Returns the dive's start date/time.
     * 
     * @see DiveLog.defaultTZ
     * @returns Date
     */
    getStart()
    {
        let start = this.#loadCache('start', () => {
            let date = this.#root.getAttribute('date');
            let time = this.#root.getAttribute('time');
            if (!date || !time) {
                throw 'Dive without start date/time';
            }
            let tz   = this.getTimeZoneUsed();
            let str  = `${date} ${time} ${tz}`;
            return str.trim();
        });
        return new Date(start);
    }

    /**
     * Returns the dive's end date/time.
     * 
     * @returns Date
     */
    getEnd()
    {
        let end = this.#loadCache('end', () => {
            let start = this.getStart();
            let dur   = this.getDuration() * 1000;
            return start.getTime() + dur;
        });
        return new Date(end);
    }

    /**
     * Returns the dive's duration, in seconds.
     * 
     * PS: Subsurface discounts dive's end from its duration. We try get really time duration
     * by last main DC's last sample
     * 
     * @returns int
     */
    getDuration()
    {
        let dur = this.#loadCache('dur', () => {
            let time = document.evaluate(
                'divecomputer[1]/sample[last()]/@time', this.#root
            ).iterateNext();
            if (time) {
                time = time.nodeValue;
            }
            else {
                time = this.#root.getAttribute('duration');
            }
            return timeToInt(time);
        });
        return dur;
    }

    /**
     * Returns dive's depths, max and mean.
     * 
     * @returns object
     */
    getDepth()
    {
        let d = this.#loadCache('depth', () => {
            // We are check all DCs stored
            let depth = document.evaluate('divecomputer/depth', this.#root);
            let el;
            let ret = {max: 0, mean: 0};
            while (el = depth.iterateNext()) {
                let obj  = domToStruct(el);
                let max  = toNumber(obj['@max'] ?? 0);
                let mean = toNumber(obj['@mean'] ?? 0);
                ret.max  = Math.max(ret.max, max);
                ret.mean = Math.max(ret.mean, mean);
            }
            return ret;
        });
        return d;
    }

    /**
     * Returns a dive's DC sample at date/time given, or null.
     * 
     * It will be considered just main DC samples.
     * 
     * Date given should be between dive duration.
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

        let alt = this.#loadCache('alt', () => {
            let tmp, bar;
            let alt = 0;
            if (this.#root.hasAttribute('airpressure')) { // Is there a pressure given by user?
                bar = toNumber(this.#root.getAttribute('airpressure'));
            }
            // No... Lets check main DC...
            else if (
                tmp = document.evaluate('divecomputer[1]/surface[last()]/@pressure', this.#root).iterateNext()
            ) {
                bar = toNumber(tmp.nodeValue);
            }
            else { // Noop...
                bar = 1;
            }
            return Math.max(alt, barToMeters(bar));
        });

        let point = Object.assign(new Point(0,0), this.#site.getPoint(), {alt: alt});
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
            this.#site && !this.#site.isLocalized() && // Site without GPS
            this.#site.setPosition(point) // Lets update it!
        ) {
            return this;
        }

        let site   = this.#diveLog.getSites().getByPosition(point, true);
        this.#site = site;
        this.#root.setAttribute('divesiteid', site.getUuid());
        return this;
    }

    /**
     * Define dive's TimeZone
     * 
     * @param {string} tz 
     * @returns Dive
     */
    setTimeZone(tz)
    {
        if (tz && !TZ_REGEX.test(tz)) {
            throw `Invalid tz: ${tz}`;
        }
        let tags  = this.#root.getAttribute('tags');
        let tzTag = tz ? `#tz:${tz}` : '';
        if (tags) {
            tags  = tags.replace(TZTAG_REGEX, '');
            tags += `, ${tzTag}`;
            tags  = tags.replace(/( *, *){2,}/, ', ')
                .replace(/^ *,/, '').replace(/ *,$/, '')
                .trim();
        }
        else if (tzTag) {
            tags = tzTag;
        }
        this.#root.setAttribute('tags', tags);
        delete(this.#cache.tz);
        delete(this.#cache.start);
        return this;
    }

    /**
     * Returns own dive's timezone.
     * 
     * @returns string
     */
    getTimeZone()
    {
        let tags = this.#root.getAttribute('tags');
        let m;
        if (tags && (m = tags.match(TZTAG_REGEX))) {
            return m[1];
        }
        return null;
    }

    /**
     * Returns dive's TimeZone used.
     * 
     * By default, dive isnt have TimeZone. So we use a trick: a special text #tz:????.
     * 
     * It could be in 2 places: in dive's tags or in dive's site notes. Where found first, it will be used.
     * Else, the system's TZ.
     * 
     * @returns string
     */
    getTimeZoneUsed()
    {
        return this.#loadCache('tz', () => {
            let tz;
            if (tz = this.getTimeZone()) { // Lets try in Dive's TZ
                this.#writeLog(`using own TZ ${tz}`);
            }
            else if (this.#site) { // Noop... Is there dive's site?
                if (tz = this.#site.getTimeZone()) { // Is there TZ defined in site?
                    this.#writeLog(`using site's defined TZ ${tz}`);
                }
                else if (this.#site.isLocalized()) { // No... Is site localized?
                    tz = this.#site.getPoint().getCalcTimeZone(); // Uses calculated TZ
                    this.#writeLog(`using site's calculated TZ ${tz}`);
                }
            }
            if (tz && !TZ_REGEX.test(tz)) { // Testing TZ validity...
                throw `Invalid dive TZ: ${tz}`;
            }
            else if (!tz) { // No TZ found... Lets use default DiveLog TZ
                tz = this.#diveLog.defaultTZ;
                this.#writeLog(`using divelog's default TZ ${tz}`);
            }
            return tz;
        });
    }

    /**
     * Returns the divesite reference, if is there one.
     * 
     * @returns DiveSite
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
        return this.#site && this.#site.isLocalized();
    }

    /**
     * Loads and return a cache information.
     * 
     * If a cache doenst exists, it will be created using function given. The function
     * will be binded to "this".
     * 
     * @param {string} key 
     * @param {Function} f 
     * @returns mixed
     */
    #loadCache(key, f)
    {
        if (!this.#cache[key]) {
            this.#cache[key] = f.bind(this)();
        }
        return this.#cache[key];
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
            'divecomputer[1]/sample[@time and @depth]', this.#root,
            null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE
        );
        let el, last;
        for (let i = 0; i < samples.snapshotLength; i++) {
            el    = samples.snapshotItem(i);
            let s = this.constructor.#sampleToObj(el);
            if (last) {
                s = Object.assign({}, last, s);
            }
            last = Object.clone(s);
            this.#samples.add(s);
        }
    }

    /**
     * Writes in console log
     * 
     * @param {string} m 
     */
    #writeLog(m)
    {
        console.log(`Dive #${this.#cache.num}: ${m}`);
    }

    /**
     * Converts a sample to a object.
     * 
     * @param {DOMElement} el Element 'sample'
     * @returns object
     */
    static #sampleToObj(el)
    {
        let obj = domToStruct(el);
        if (!obj['@time'] || !obj['@depth']) {
            return null;
        }
        let s = {
            'time':  timeToInt(obj['@time']),
            'depth': toNumber(obj['@depth'])
        }
        if (obj['@temp']) {
            s.temp = toNumber(obj['@temp']);
        }
        if (obj['@heartbeat']) {
            s.heart = toNumber(obj['@heartbeat']);
        }
        return s;
    }
}