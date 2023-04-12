import './proto.js';

/**
 * Utility class to convert GPS degrees to meters.
 * 
 */
class GeoDistConversor
{
    constructor()
    {
        this.repo = new Map();
    }

    /**
     * Returns convert factor using latitude given.
     * 
     * @param {float} lat 
     * @returns int
     */
    _f(lat)
    {
        const D2M = 111317; // Meters in 1 lat degree at Equador line
        let key = lat.toFixed(1);
        if (!this.repo.has(key)) {
            let val = parseInt(D2M * Math.cos(Math.toRadians(lat))); // Uses latitude to make a specific perimeter
            this.repo.set(key, val);
            return val;
        }
        return this.repo.get(key);
    }

    /**
     * Converts meters to degrees.
     * 
     * @param {float} mtr Meters
     * @param {float} lat Latitude
     * @returns float
     */
    toDeg(mtr, lat=0)
    {
        return mtr / this._f(lat);
    }

    /**
     * Converts degrees to meters.
     * 
     * @param {float} deg Degrees
     * @param {float} lat Latitude
     * @returns float
     */
    toMtr(deg, lat=0)
    {
        return deg * this._f(lat);
    }
}
const distConv = new GeoDistConversor();

/**
* Represents a Geo point
* 
*/
export class Point
{
    /**
     * 
     * @param {float} lat 
     * @param {float} lon 
     */
    constructor(lat, lon, alt=0)
    {
        this.lat = Math.rounds(lat, 7);
        this.lon = Math.rounds(lon, 7);
        this.alt = Math.rounds(alt ?? 0, 2);
    }

    /**
     * 
     * @return string
     */
    get coords()
    {
        return `${this.lat} ${this.lon}`;
    }

    /**
     * 
     * @returns string
     */
    get desc()
    {
        return this.name ?? this.coords;
    }
 
    /**
     * Returns the 2D distance between this point and given point, in meters.
     * 
     * Note: It uses Pythagoras' theorem for performance but can be wrong for longer distances. However, longer
     * distances isn't goal from this project.
     * 
     * @param {Point} point 
     * @returns float
     */
    distanceTo(point)
    {
        let dx = point.lon - this.lon;
        let dy = point.lat - this.lat;
        let dh = Math.hypot(dx, dy);
        return distConv.toMtr(dh, (this.lat + point.lat) / 2);
    }

    /**
     * Returns a calculated TimeZone using point longitude.
     * 
     * Timezone returned can be different from real because political borders.
     * 
     * @returns string
     */
    getCalcTimeZone()
    {
        let h      = Math.rounds(this.lon / 15, 0);
        let signal = h < 0 ? '-' : '+';
        let tz     = signal + String(Math.abs(h)).padStart(2, '0') + '00';
        return tz;
    }
}
