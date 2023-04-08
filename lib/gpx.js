import { Point } from './geo.js';
import { Interpolator } from './interpolator.js';
import './proto.js';
import { domToStruct } from './utils.js';

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
    #trackPoi;
    #stops;
    #stoppedUntil;
    
    /**
     * 
     * @param {bool} trackPoi Adds start/stop POIs to tracks?
     * @param {bool} detectStop Detect and dont store stops?
     */
    constructor(trackPoi = false, detectStop = false)
    {
        this.#curGroup;
        this.#lastPoint;
        this.#points;
        this.#xml;
        this.#trackPoi = !!trackPoi;
        this.#stops    = !!detectStop;
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
            this.#xml += "    </trkseg>\n    <trkseg>\n";    
        }
        else if (
            this.#stops && this.#lastPoint
            && this.#lastPoint.distanceTo(point) <= 1
        ) { // Is stopped? Don't add...
            this.#stoppedUntil = dateTime.getTime();
            this.#lastPoint.alt = point.alt;
            return;
        }

        this.#stoppedPoint(); // When move again, add last point with new time        
        this.#lastPoint = Object.assign(new Point(0, 0), point);
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
            me.#xml += "  " + me.#makePoint(clone, null, true);
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
        this.#xml += "      " + this.#makePoint(point, dateTime);
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
        if (this.#trackPoi) {
            let name = "{0}: Start Point".format(group);
            this.addWayPoint(Object.assign({}, point, {name: name}));
        }
        this.#xml += "  <trk>\n    <name>{0}</name>\n    <trkseg>\n".format(group);
    }
    
    /**
     * 
     */
    #endTrack()
    {
        this.#stoppedPoint();
        if (this.#trackPoi) {
            let name = "{0}: End Point".format(this.#curGroup);
            this.addWayPoint(Object.assign({}, this.#lastPoint, {name: name}));
        }
        this.#xml += "    </trkseg>\n  </trk>\n";
    }

    #stoppedPoint()
    {
        if (this.#stoppedUntil) {
            this.#addTrkPoint(this.#lastPoint, new Date(this.#stoppedUntil));
            this.#stoppedUntil = null;
        }
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
     * @param {DOMElement|object} el Element 'trkpt', 'wpt' or a struct of both
     * @returns Point
     */
    static #elToPoint(el)
    {
        let obj   = el.tagName ? domToStruct(el, 1) : el;
        let point = new Point(parseFloat(obj['@lat']), parseFloat(obj['@lon']));
        if (obj.ele) {
            point.alt = parseFloat(obj.ele[0]['*']);
        }
        if (obj.name) {
            point.name = obj.name[0]['*'];
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
            let obj = domToStruct(el, 1);
            if (!obj.time) {
                continue;
            }
            let p  = this.constructor.#elToPoint(obj);
            let s  = Object.clone(p);
            s.time = Date.create(obj.time[0]['*']).getTimeSeconds();
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