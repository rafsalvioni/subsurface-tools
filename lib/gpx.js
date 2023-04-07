import { Point } from './geo.js';
import { Interpolator } from './interpolator.js';
import './proto.js';
import { isNumeric } from './utils.js';

/**
 * Utility class to generate GPX files.
 * 
 */
export class GpxWriter
{
    #curGroup;
    #lastPoint;
    #points;
    #xml;
    
    constructor()
    {
        this.#curGroup;
        this.#lastPoint;
        this.#points;
        this.#xml;
    }

    /**
     * Creates a new GPX
     */
    create()
    {
        this.#curGroup  = null;
        this.#lastPoint = null;
        this.#points    = [];
        this.#xml = "<?xml version=\"1.0\" encoding=\"UTF-8\" ?>\n\
<gpx\
 xmlns=\"http://www.topografix.com/GPX/1/1\"\
 creator=\"Salvioni\'s GPX Creator\" \
 version=\"1.1\"\
 xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" \
 xsi:schemaLocation=\"http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd\">\n";
    }

    /**
     * Sets a point as way point.
     * 
     * @param {Point} point 
     */
    addWayPoint(point)
    {
        this.#points.push(point);
    }
    
    /**
     * Adds a position to GPX.
     * 
     * @param {Point} point 
     * @param {Date} dateTime 
     * @param {String} group Point's group
     * @param {bool} newseg Force new segment?
     */
    addPos(point, dateTime, group = null, newseg = false)
    {
        if (!group) {
            group = dateTime.toLocaleDateString();
        }
        if (group != this.#curGroup) { // When group was change (track)
            if (this.#curGroup) {
                this.#endTrack();
            }
            this.#startTrack(group, point);
        }
        else if (newseg) {
            this.#xml += "\t\t</trkseg>\n\t\t<trkseg>\n";    
        }
        
        this.#lastPoint = point;
        this.#addTrkPoint(point, dateTime);
    }
    
    /**
     * Ends current GPX e flushs their contents.
     * 
     * @return {String}
     */
    end()
    {
        if (this.#lastPoint) {
            this.#endTrack();
        }
        var i  = 1;
        var me = this;
        this.#points.map(p => {
            let clone = Object.clone(p);
            if (!clone.name) {
                clone.name = "POI #{0}".format(i++);
            }
            me.#xml += "\t" + me.#makePoint(clone, null, true);
        })
        let xml = this.#xml + '</gpx>';
        this.create();
        return xml;
    }

    /**
     * Current GPX has contents?
     * 
     * @returns boolean
     */
    hasContents()
    {
        return this.#curGroup != null;
    }

    /**
     * 
     * @param {Point} point 
     * @param {Date} dateTime 
     */
    #addTrkPoint(point, dateTime)
    {
        this.#xml += "\t\t\t" + this.#makePoint(point, dateTime);
    }

    /**
     * 
     * @param {Point} point 
     * @param {Date} dateTime 
     * @param {bool} wpt 
     * @returns string
     */
    #makePoint(point, dateTime = null, wpt = false)
    {
        let name = '';
        let tag  = '';
        let dt   = '';
        if (!wpt && dateTime) { // Track point if has a instant
            tag = 'trk';
        }
        else if (point.name) { // Way point if has a name
            tag  = 'w';
            name = `<name>${point.name.entitiesEncode()}</name>`;
        }
        else { // None.. Return empty
            return '';
        }
        if (dateTime) {
            dt = `<time>${dateTime.toISOString()}</time>`;
        }
        let xml = `<${tag}pt lat="${point.lat}" lon="${point.lon}"><ele>${point.alt ?? 0}</ele>${dt}${name}</${tag}pt>\n`;
        return xml;
    }
    
    /**
     * 
     * @param {String} group 
     * @param {Point} point 
     */
    #startTrack(group, point)
    {
        this.#curGroup = group;
        //let name = "{0}: Start Point".format(group);
        //this.addWayPoint(Object.assign({}, point, {name: name}));
        this.#xml += "\t<trk>\n\t\t<name>{0}</name>\n\t\t<trkseg>\n".format(group);
    }
    
    /**
     * 
     */
    #endTrack()
    {
        //let name = "{0}: End Point".format(this.#curGroup);
        //this.addWayPoint(Object.assign({}, this.#lastPoint, {name: name}));
        this.#xml += "\t\t</trkseg>\n\t</trk>\n";
    }
}

/**
 * Represents a GPX Reader
 * 
 */
export class GpxReader
{
    #root;
    #samples;
    
    /**
     * 
     * @param {string} gpxString GPX XML
     */
    constructor(gpxString)
    {
        let doc = (new DOMParser()).parseFromString(gpxString, "text/xml");
        if (doc.childNodes.length == 1 && doc.childNodes[0].tagName == 'gpx') {
            this.#root    = doc.childNodes[0];
            this.#samples = new Interpolator('time');
        }
        else {
            throw 'Invalid GPX XML';
        }
    }
    
    /**
     * Returns a position at instant given or null.
     * 
     * @param {Date} dt 
     * @returns Point
     */
    getPositionAt(dt)
    {
        this.#loadSamples();
        let ts = dt.getTimeSeconds();
        let s  = this.#samples.sampleAt(ts);
        if (s && s._sel_.inter && s._sel_.distMax <= 1800) { // Only interpolated and max 30 min dist
            let p  = new Point(s.lat, s.lon, s.alt);
            p.name = this.getPositionName(p);
            return p;
        }
        return null;
    }
    
    /**
     * Iterates each POI
     * 
     * @return Point
     */
    *eachPoi()
    {
        let pois = document.evaluate(`//*[local-name()='wpt' and @lat and @lon]`, this.#root);
        let el;
        while (el = pois.iterateNext()) {
            yield this.constructor.#elToPoint(el);
        }
    }

    /**
     * Try to find a point's name.
     * 
     * Returns null if not found.
     * 
     * @param {Point} point 
     * @returns string
     */
    getPositionName(point)
    {
        if (point.name) {
            return point.name;
        }
        let res = this.#getPoisAround(point, 4); // ~10 m
        let el  = res.iterateNext(); // Found one?
        let p;
        if (el && (p = this.constructor.#elToPoint(el)) && p.name) {
            return p.name;
        }
        return null;
    }
    
    /**
     * Converts a DOMElement in a Point
     * 
     * @param {DOMElement} el Element 'trkpt' or 'wpt'
     * @returns Point
     */
    static #elToPoint(el)
    {
        let lat   = parseFloat(el.getAttribute('lat'));
        let lon   = parseFloat(el.getAttribute('lon'));
        let point = new Point(lat, lon);
        for (const child of el.childNodes) {
            switch (child.tagName) {
                case 'ele':
                    point.alt = isNumeric(child.innerText) ? parseFloat(child.innerText) : 0;
                    break;
                case 'name':
                    point.name = child.textContent;
                    break;
            }
        }
        return point;
    }

    /**
     * Loads positions in Interpolator
     * 
     */
    #loadSamples()
    {
        if (!this.#samples.isEmpty()) {
            return;
        }
        let samples = document.evaluate(
            '//*[local-name()=\'trkpt\' and @lat and @lon]', // local-name() to ignore NS
            this.#root, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE
        );
        let el;
        while (el = samples.iterateNext()) {
            let time = el.getElementsByTagName('time');
            if (!time[0]) {
                continue;
            }
            let p  = this.constructor.#elToPoint(el);
            let s  = Object.clone(p);
            s.time = Date.create(time[0].textContent).getTimeSeconds();
            this.#samples.add(s);
        }
    }

    /**
     * Search POIs near given point.
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
    #getPoisAround(point, p=4)
    {
        let pow = Math.pow(10, p);
        let lat = parseInt(point.lat * pow) / pow;
        let lon = parseInt(point.lon * pow) / pow;
        let res = document.evaluate(
            `//*[local-name()='wpt' and starts-with(@lat,'${lat}') and starts-with(@lon,'${lon}')]`,
            this.#root
        );
        return res;
    }
}