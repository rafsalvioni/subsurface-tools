import { isNumeric } from "./utils.js";

/**
 * Represents a linear interpolator
 * 
 * Its stores a collection of samples and use them to calculate
 * linear interpolation
 * 
 */
export class Interpolator
{
	#samples;
	#xKey;
	
	/**
	 * Calculates linear interpolation.
	 * 
	 * @param {number} x1 
	 * @param {number} y1 
	 * @param {number} x2 
	 * @param {number} y2 
	 * @param {number} x 
	 * @returns number
	 */
	static calc(x1, y1, x2, y2, x)
	{
		if (x1 == x2) { // Avoid division by zero
			return y1;
		}
		let d = (x - x1) / (x2 - x1);
		let y = y1 + d * (y2 - y1);
		return y;
	}
	
	/**
	 * 
	 * @param {string} xKey Sample key field (X axe)
	 */
	constructor(xKey)
	{
		this.#xKey = xKey;
        this.#samples = new Map();
	}
	
	/**
	 * Adds a sample
	 * 
	 * @param {object} s 
	 * @returns Interpolator
	 */
	add(s)
	{
		if (!(this.#xKey in s) || !isNumeric(s[this.#xKey])) {
			throw 'Invalid sample';
		}
		this.#samples.set(s[this.#xKey], Object.clone(s));
		return this;
	}

	/**
	 * Calculates a Y value, to a X value given, using samples stored.
	 * 
	 * With a X, will be choose the best samples for it. If found criteria matches 2 samples,
	 * they will be used to calculate a interpolated sample.
	 * 
	 * Else, return null
	 * 
	 * @param {number} x 
	 * @returns object
	 */
	sampleAt(x)
	{
		let sel;
		if (!(sel = this.#selectInput(x))) { // Select samples according value needed
			return null; // Isnt there? Return null
		}

		let res = {_sel_: sel};
		let pk  = this.#xKey;

		// We have 2 samples. Lets calc a interpolated sample
		for (const k in sel.s1) {
            let v = sel.s1[k];
            if (!isNumeric(v) || !isNumeric(sel.s2[k])) {
                res[k] = null;
                continue;
            }
			// All sample's fields are calculated
			res[k] = this.constructor.calc(sel.s1[pk], v, sel.s2[pk], sel.s2[k], x);
		}

		//this.#samples.set(x, res); // Cache. Add the calculated sample in repo
		return res;
	}

	/**
	 * Isnt there samples?
	 * 
	 * @returns bool
	 */
	isEmpty()
	{
		return this.#samples.size == 0;
	}
	
	/**
	 * Selects the best samples to calculates interpolation for X.
	 * 
	 * Returns a object with S1 and S2, or null.
	 * 
	 * @param {number} x 
	 * @returns object
	 */
	#selectInput(x)
	{
		let s1, s2;
		if (this.#samples.has(x)) { // Is there a exact sample?
			return {
				s1: this.#samples.get(x), s2: this.#samples.get(x),
				inter: true, distMax: 0
			}; // Found
		}

		let before = [];
		let after  = [];
		let dist   = 0;
		//this.#samples = new Map([...this.#samples.entries()].sort()) // Ordering by index
		for (const s of this.#samples) {
            let k = s[0];
			dist  = Math.max(Math.abs(k - x), dist);
			if (k < x) { // Is a before sample?
				before.push(s[1]);
				if (before[2]) { // We wanna last two
					before.shift();
				}
			}
			else if (k > x) { // Is a after sample?
				after.push(s[1]);
				if (before[0] || after[1]) { // Is there a sample before or 2 after?
					break; // We dont need more samples
				}
			}
		}
		let inter = false;
		if (before[0] && after[0]) { // Interpolation (nearest samples before and after)
			s1    = before.pop();
			s2    = after.shift();
			inter = true;
		}
		else if (before[1]) { // Extrapolation. Value after samples
			s1 = before.shift();
			s2 = before.shift();
		}
		else if (after[1]) { // Extrapolation. Value before samples
			s1 = after.shift();
			s2 = after.shift();
		}
		else {
			// We need 2 samples at least. Isn't there? Return empty
			return null;
		}
		return {s1: s1, s2: s2, inter: inter, distMax: dist};
	}
}
