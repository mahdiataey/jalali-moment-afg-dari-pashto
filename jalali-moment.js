
module.exports = jMoment;

var moment = require("moment/moment");
require("moment/locale/fa");

/************************************
 Constants
 ************************************/

var formattingTokens = /(\[[^\[]*\])|(\\)?j(Mo|MM?M?M?|Do|DDDo|DD?D?D?|w[o|w]?|YYYYY|YYYY|YY|gg(ggg?)?|)|(\\)?(Mo|MM?M?M?|Do|DDDo|DD?D?D?|ddd?d?|do?|w[o|w]?|W[o|W]?|YYYYY|YYYY|YY|gg(ggg?)?|GG(GGG?)?|e|E|a|A|hh?|HH?|mm?|ss?|SS?S?|X|zz?|ZZ?|.)/g
    , localFormattingTokens = /(\[[^\[]*\])|(\\)?(LT|LL?L?L?|l{1,4})/g
    , parseTokenOneOrTwoDigits = /\d\d?/
    , parseTokenOneToThreeDigits = /\d{1,3}/
    , parseTokenThreeDigits = /\d{3}/
    , parseTokenFourDigits = /\d{1,4}/
    , parseTokenSixDigits = /[+\-]?\d{1,6}/
    , parseTokenWord = /[0-9]*["a-z\u00A0-\u05FF\u0700-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]+|[\u0600-\u06FF\/]+(\s*?[\u0600-\u06FF]+){1,2}/i
    , parseTokenTimezone = /Z|[\+\-]\d\d:?\d\d/i
    , parseTokenT = /T/i
    , parseTokenTimestampMs = /[\+\-]?\d+(\.\d{1,3})?/

    , unitAliases = {
        jm: "jmonth"
        , jmonths: "jmonth"
        , jy: "jyear"
        , jyears: "jyear"
    }

    , formatFunctions = {}

    , ordinalizeTokens = "DDD w M D".split(" ")
    , paddedTokens = "M D w".split(" ");

var CalendarSystems = {
    Jalali: 1,
    Gregorian: 2,
}
var formatTokenFunctions = {
    jM: function () {
        return this.jMonth() + 1;
    },
    jMMM: function (format) {
        return this.localeData().jMonthsShort(this, format);
    },
    jMMMM: function (format) {
        return this.localeData().jMonths(this, format);
    },
    jD: function () {
        return this.jDate();
    },
    jDDD: function () {
        return this.jDayOfYear();
    },
    jw: function () {
        return this.jWeek();
    },
    jYY: function () {
        return leftZeroFill(this.jYear() % 100, 2);
    },
    jYYYY: function () {
        return leftZeroFill(this.jYear(), 4);
    },
    jYYYYY: function () {
        return leftZeroFill(this.jYear(), 5);
    },
    jgg: function () {
        return leftZeroFill(this.jWeekYear() % 100, 2);
    },
    jgggg: function () {
        return this.jWeekYear();
    },
    jggggg: function () {
        return leftZeroFill(this.jWeekYear(), 5);
    }
};

function padToken(func, count) {
    return function (a) {
        return leftZeroFill(func.call(this, a), count);
    };
}
function ordinalizeToken(func, period) {
    return function (a) {
        return this.localeData().ordinal(func.call(this, a), period);
    };
}

(function () {
    var i;
    while (ordinalizeTokens.length) {
        i = ordinalizeTokens.pop();
        formatTokenFunctions["j" + i + "o"] = ordinalizeToken(formatTokenFunctions["j" + i], i);
    }
    while (paddedTokens.length) {
        i = paddedTokens.pop();
        formatTokenFunctions["j" + i + i] = padToken(formatTokenFunctions["j" + i], 2);
    }
    formatTokenFunctions.jDDDD = padToken(formatTokenFunctions.jDDD, 3);
}());

/************************************
 Helpers
 ************************************/

function extend(a, b) {
    var key;
    for (key in b)
        if (b.hasOwnProperty(key)){
            a[key] = b[key];
        }
    return a;
}

/**
 * return a string which length is as much as you need
 * @param {number} number input
 * @param {number} targetLength expected length
 * @example leftZeroFill(5,2) => 05
 **/
function leftZeroFill(number, targetLength) {
    var output = number + "";
    while (output.length < targetLength){
        output = "0" + output;
    }
    return output;
}

/**
 * determine object is array or not
 * @param input
 **/
function isArray(input) {
    return Object.prototype.toString.call(input) === "[object Array]";
}

/**
 * Changes any moment Gregorian format to Jalali system format
 * @param {string} format
 * @example toJalaliFormat("YYYY/MMM/DD") => "jYYYY/jMMM/jDD"
 **/
function toJalaliFormat(format) {
    for (var i = 0; i < format.length; i++) {
        if(!i || (format[i-1] !== "j" && format[i-1] !== format[i])) {
            if (format[i] === "Y" || format[i] === "M" || format[i] === "D" || format[i] === "g") {
                format = format.slice(0, i) + "j" + format.slice(i);
            }
        }
    }
    return format;
}

/**
 * Changes any moment Gregorian units to Jalali system units
 * @param {string} units
 * @example toJalaliUnit("YYYY/MMM/DD") => "jYYYY/jMMM/jDD"
 **/
function toJalaliUnit(units) {
    switch (units) {
        case "week" : return "jWeek";
        case "year" : return "jYear";
        case "month" : return "jMonth";
        case "months" : return "jMonths";
        case "monthName" : return "jMonthsShort";
        case "monthsShort" : return "jMonthsShort";
    }
    return units;
}

/**
 * normalize units to be comparable
 * @param {string} units
 **/
function normalizeUnits(units, momentObj) {
    if (isJalali(momentObj)) {
        units = toJalaliUnit(units);
    }
     if (units) {
        var lowered = units.toLowerCase();
        if (lowered.startsWith('j')) units = unitAliases[lowered] || lowered;
        // TODO : add unit test
        if (units === "jday") units = "day";
        else if (units === "jd") units = "d";
    }
    return units;
}

/**
 * set a gregorian date to moment object
 * @param {string} momentInstance
 * @param {string} year in gregorian system
 * @param {string} month in gregorian system
 * @param {string} day in gregorian system
 **/
function setDate(momentInstance, year, month, day) {
    var d = momentInstance._d;
    if (momentInstance._isUTC) {
        /*eslint-disable new-cap*/
        momentInstance._d = new Date(Date.UTC(year, month, day,
            d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds()));
        /*eslint-enable new-cap*/
    } else {
        momentInstance._d = new Date(year, month, day,
            d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds());
    }
}

function objectCreate(parent) {
    function F() {}
    F.prototype = parent;
    return new F();
}

function getPrototypeOf(object) {
    if (Object.getPrototypeOf){
        return Object.getPrototypeOf(object);
    }
    else if ("".__proto__){
        return object.__proto__;
    }
    else{
        return object.constructor.prototype;
    }
}

/************************************
 Languages
 ************************************/
extend(getPrototypeOf(moment.localeData()),
    { _jMonths: [ "Farvardin"
        , "Ordibehesht"
        , "Khordaad"
        , "Tir"
        , "Mordaad"
        , "Shahrivar"
        , "Mehr"
        , "Aabaan"
        , "Aazar"
        , "Dey"
        , "Bahman"
        , "Esfand"
    ]
        , jMonths: function (m) {
            if (m) {
                return this._jMonths[m.jMonth()];
            } else {
                return this._jMonths;
            }
    }

        , _jMonthsShort:  [ "Far"
        , "Ord"
        , "Kho"
        , "Tir"
        , "Amo"
        , "Sha"
        , "Meh"
        , "Aab"
        , "Aaz"
        , "Dey"
        , "Bah"
        , "Esf"
    ]
        , jMonthsShort: function (m) {
        if (m) {
            return this._jMonthsShort[m.jMonth()];
        } else {
            return this._jMonthsShort;
        }
    }

        , jMonthsParse: function (monthName) {
        var i
            , mom
            , regex;
        if (!this._jMonthsParse){
            this._jMonthsParse = [];
        }
        for (i = 0; i < 12; i += 1) {
            // Make the regex if we don"t have it already.
            if (!this._jMonthsParse[i]) {
                mom = jMoment([2000, (2 + i) % 12, 25]);
                regex = "^" + this.jMonths(mom, "") + "|^" + this.jMonthsShort(mom, "");
                this._jMonthsParse[i] = new RegExp(regex.replace(".", ""), "i");
            }
            // Test the regex.
            if (this._jMonthsParse[i].test(monthName)){
                return i;
            }
        }
    }
    }
);

/************************************
 Formatting
 ************************************/

function makeFormatFunction(format) {
    var array = format.match(formattingTokens)
        , length = array.length
        , i;

    for (i = 0; i < length; i += 1){
        if (formatTokenFunctions[array[i]]){
            array[i] = formatTokenFunctions[array[i]];
        }
    }
    return function (mom) {
        var output = "";
        for (i = 0; i < length; i += 1){
            output += array[i] instanceof Function ? "[" + array[i].call(mom, format) + "]" : array[i];
        }
        return output;
    };
}

/************************************
 Parsing
 ************************************/

function getParseRegexForToken(token, config) {
    switch (token) {
        case "jDDDD":
            return parseTokenThreeDigits;
        case "jYYYY":
            return parseTokenFourDigits;
        case "jYYYYY":
            return parseTokenSixDigits;
        case "jDDD":
            return parseTokenOneToThreeDigits;
        case "jMMM":
        case "jMMMM":
            return parseTokenWord;
        case "jMM":
        case "jDD":
        case "jYY":
        case "jM":
        case "jD":
            return parseTokenOneOrTwoDigits;
        case "DDDD":
            return parseTokenThreeDigits;
        case "YYYY":
            return parseTokenFourDigits;
        case "YYYYY":
            return parseTokenSixDigits;
        case "S":
        case "SS":
        case "SSS":
        case "DDD":
            return parseTokenOneToThreeDigits;
        case "MMM":
        case "MMMM":
        case "dd":
        case "ddd":
        case "dddd":
            return parseTokenWord;
        case "a":
        case "A":
            return moment.localeData(config._l)._meridiemParse;
        case "X":
            return parseTokenTimestampMs;
        case "Z":
        case "ZZ":
            return parseTokenTimezone;
        case "T":
            return parseTokenT;
        case "MM":
        case "DD":
        case "YY":
        case "HH":
        case "hh":
        case "mm":
        case "ss":
        case "M":
        case "D":
        case "d":
        case "H":
        case "h":
        case "m":
        case "s":
            return parseTokenOneOrTwoDigits;
        default:
            return new RegExp(token.replace("\\", ""));
    }
}
function isNull(variable) {
    return variable === null || variable === undefined;
}
function addTimeToArrayFromToken(token, input, config) {
    var a
        , datePartArray = config._a;

    switch (token) {
        case "jM":
        case "jMM":
            datePartArray[1] = isNull(input)? 0 : ~~input - 1;
            break;
        case "jMMM":
        case "jMMMM":
            a = moment.localeData(config._l).jMonthsParse(input);
            if (!isNull(a)){
                datePartArray[1] = a;
            }
            else{
                config._isValid = false;
            }
            break;
        case "jD":
        case "jDD":
        case "jDDD":
        case "jDDDD":
            if (!isNull(input)){
                datePartArray[2] = ~~input;
            }
            break;
        case "jYY":
            datePartArray[0] = ~~input + (~~input > 47 ? 1300 : 1400);
            break;
        case "jYYYY":
        case "jYYYYY":
            datePartArray[0] = ~~input;
    }
    if (isNull(input)) {
        config._isValid = false;
    }
}

function dateFromArray(config) {
    var g
        , j
        , jy = config._a[0]
        , jm = config._a[1]
        , jd = config._a[2];

    if (isNull(jy) && isNull(jm) && isNull(jd)){
        return;
    }
    jy = !isNull(jy) ? jy : 0;
    jm = !isNull(jm) ? jm : 0;
    jd = !isNull(jd) ? jd : 1;
    if (jd < 1 || jd > jMoment.jDaysInMonth(jy, jm) || jm < 0 || jm > 11){
        config._isValid = false;
    }
    g = toGregorian(jy, jm, jd);
    j = toJalali(g.gy, g.gm, g.gd);
    config._jDiff = 0;
    if (~~j.jy !== jy){
        config._jDiff += 1;
    }
    if (~~j.jm !== jm){
        config._jDiff += 1;
    }
    if (~~j.jd !== jd){
        config._jDiff += 1;
    }
    return [g.gy, g.gm, g.gd];
}

function makeDateFromStringAndFormat(config) {
    var tokens = config._f.match(formattingTokens)
        , string = config._i + ""
        , len = tokens.length
        , i
        , token
        , parsedInput;

    config._a = [];

    for (i = 0; i < len; i += 1) {
        token = tokens[i];
        parsedInput = (getParseRegexForToken(token, config).exec(string) || [])[0];
        if (parsedInput){
            string = string.slice(string.indexOf(parsedInput) + parsedInput.length);
        }
        if (formatTokenFunctions[token]){
            addTimeToArrayFromToken(token, parsedInput, config);
        }
    }
    if (string){
        config._il = string;
    }
    return dateFromArray(config);
}

function makeDateFromStringAndArray(config, utc) {
    var len = config._f.length
        , i
        , format
        , tempMoment
        , bestMoment
        , currentScore
        , scoreToBeat;

    if (len === 0) {
        return makeMoment(new Date(NaN));
    }

    for (i = 0; i < len; i += 1) {
        format = config._f[i];
        currentScore = 0;
        tempMoment = makeMoment(config._i, format, config._l, config._strict, utc);

        if (!tempMoment.isValid()){
            continue;
        }

        // currentScore = compareArrays(tempMoment._a, tempMoment.toArray())
        currentScore += tempMoment._jDiff;
        if (tempMoment._il){
            currentScore += tempMoment._il.length;
        }
        if (isNull(scoreToBeat) || currentScore < scoreToBeat) {
            scoreToBeat = currentScore;
            bestMoment = tempMoment;
        }
    }

    return bestMoment;
}

function removeParsedTokens(config) {
    var string = config._i + ""
        , input = ""
        , format = ""
        , array = config._f.match(formattingTokens)
        , len = array.length
        , i
        , match
        , parsed;

    for (i = 0; i < len; i += 1) {
        match = array[i];
        parsed = (getParseRegexForToken(match, config).exec(string) || [])[0];
        if (parsed){
            string = string.slice(string.indexOf(parsed) + parsed.length);
        }
        if (!(formatTokenFunctions[match] instanceof Function)) {
            format += match;
            if (parsed){
                input += parsed;
            }
        }
    }
    config._i = input;
    config._f = format;
}

/************************************
 Week of Year
 ************************************/

function jWeekOfYear(mom, firstDayOfWeek, firstDayOfWeekOfYear) {
    var end = firstDayOfWeekOfYear - firstDayOfWeek
        , daysToDayOfWeek = firstDayOfWeekOfYear - mom.day()
        , adjustedMoment;

    if (daysToDayOfWeek > end) {
        daysToDayOfWeek -= 7;
    }
    if (daysToDayOfWeek < end - 7) {
        daysToDayOfWeek += 7;
    }
    adjustedMoment = jMoment(mom).add(daysToDayOfWeek, "d");
    return  { week: Math.ceil(adjustedMoment.jDayOfYear() / 7)
        , year: adjustedMoment.jYear()
    };
}

/************************************
 Top Level Functions
 ************************************/
function isJalali (momentObj) {
    return momentObj &&
        (momentObj.calSystem === CalendarSystems.Jalali) ||
        (moment.justUseJalali && momentObj.calSystem !== CalendarSystems.Gregorian);
}
function isInputJalali(format, momentObj, input) {
    return (moment.justUseJalali || (momentObj && momentObj.calSystem === CalendarSystems.Jalali))
}
function makeMoment(input, format, lang, strict, utc) {
    if (typeof lang === "boolean") {
        utc = utc || strict;
        strict = lang;
        lang = undefined;
    }
    if (moment.ISO_8601 === format) {
        format = 'YYYY-MM-DDTHH:mm:ss.SSSZ';
    }
    const inputIsJalali = isInputJalali(format, this, input);
    // var itsJalaliDate = (isJalali(this));
    if(input && (typeof input === "string") && !format && inputIsJalali && !moment.useGregorianParser) {
        input = input.replace(/\//g,"-");
        if(/\d{4}\-\d{2}\-\d{2}/.test(input)) {
            format = "jYYYY-jMM-jDD";
        } else if (/\d{4}\-\d{2}\-\d{1}/.test(input)) {
            format = "jYYYY-jMM-jD";
        } else if (/\d{4}\-\d{1}\-\d{1}/.test(input)) {
            format = "jYYYY-jM-jD";
        } else if (/\d{4}\-\d{1}\-\d{2}/.test(input)) {
            format = "jYYYY-jM-jDD";
        } else if (/\d{4}\-W\d{2}\-\d{2}/.test(input)) {
            format = "jYYYY-jW-jDD";
        } else if (/\d{4}\-\d{3}/.test(input)) {
            format = "jYYYY-jDDD";
        } else if (/\d{8}/.test(input)) {
            format = "jYYYYjMMjDD";
        } else if (/\d{4}W\d{2}\d{1}/.test(input)) {
            format = "jYYYYjWWjD";
        } else if (/\d{4}W\d{2}/.test(input)) {
            format = "jYYYYjWW";
        } else if (/\d{4}\d{3}/.test(input)) {
            format = "jYYYYjDDD";
        }
    }
    if (format && inputIsJalali){
        format = toJalaliFormat(format);
    }
    if (format && typeof format === "string"){
        format = fixFormat(format, moment);
    }

    var config =
        { _i: input
            , _f: format
            , _l: lang
            , _strict: strict
            , _isUTC: utc
        }
        , date
        , m
        , jm
        , origInput = input
        , origFormat = format;
    if (format) {
        if (isArray(format)) {
            return makeDateFromStringAndArray(config, utc);
        } else {
            date = makeDateFromStringAndFormat(config);
            removeParsedTokens(config);
            if (date) {
                format = "YYYY-MM-DD-" + config._f;
                input = leftZeroFill(date[0], 4) + "-"
                    + leftZeroFill(date[1] + 1, 2) + "-"
                    + leftZeroFill(date[2], 2) + "-"
                    + config._i;
            }
        }
    }
    if (utc){
        m = moment.utc(input, format, lang, strict);
    }
    else{
        m = moment(input, format, lang, strict);
    }
    if (config._isValid === false || (input && input._isAMomentObject && !input._isValid)){
        m._isValid = false;
    }
    m._jDiff = config._jDiff || 0;
    jm = objectCreate(jMoment.fn);
    extend(jm, m);
    if (strict && jm.isValid()) {
        jm._isValid = jm.format(origFormat) === origInput;
    }
    if (input && input.calSystem) {
        jm.calSystem = input.calSystem;
    }
    return jm;
}

function jMoment(input, format, lang, strict) {
    return makeMoment(input, format, lang, strict, false);
}

extend(jMoment, moment);
jMoment.fn = objectCreate(moment.fn);

jMoment.utc = function (input, format, lang, strict) {
    return makeMoment(input, format, lang, strict, true);
};

jMoment.unix = function (input) {
    return makeMoment(input * 1000);
};

/************************************
 jMoment Prototype
 ************************************/

function fixFormat(format, _moment) {
    var i = 5;
    var replace = function (input) {
        return _moment.localeData().longDateFormat(input) || input;
    };
    while (i > 0 && localFormattingTokens.test(format)) {
        i -= 1;
        format = format.replace(localFormattingTokens, replace);
    }
    return format;
}

jMoment.fn.format = function (format) {
	format = format || jMoment.defaultFormat;
    if (format) {
        if (isJalali(this)) {
            format = toJalaliFormat(format);
        }
        format = fixFormat(format, this);

        if (!formatFunctions[format]) {
            formatFunctions[format] = makeFormatFunction(format);
        }
        format = formatFunctions[format](this);
    }
    var formatted = moment.fn.format.call(this, format);
    return formatted;
};

jMoment.fn.year = function (input) {
    if (isJalali(this)) return jMoment.fn.jYear.call(this,input);
    else return moment.fn.year.call(this, input);
};
jMoment.fn.jYear = function (input) {
    var lastDay
        , j
        , g;
    if (typeof input === "number") {
        j = getJalaliOf(this);
        lastDay = Math.min(j.jd, jMoment.jDaysInMonth(input, j.jm));
        g = toGregorian(input, j.jm, lastDay);
        setDate(this, g.gy, g.gm, g.gd);
        moment.updateOffset(this);
        return this;
    } else {
        return getJalaliOf(this).jy;
    }
};

jMoment.fn.month = function (input) {
    if (isJalali(this)) return jMoment.fn.jMonth.call(this,input);
    else return moment.fn.month.call(this, input);
};
jMoment.fn.jMonth = function (input) {
    var lastDay
        , j
        , g;
    if (!isNull(input)) {
        if (typeof input === "string") {
            input = this.localeData().jMonthsParse(input);
            if (typeof input !== "number"){
                return this;
            }
        }
        j = getJalaliOf(this);
        lastDay = Math.min(j.jd, jMoment.jDaysInMonth(j.jy, input));
        this.jYear(j.jy + div(input, 12));
        input = mod(input, 12);
        if (input < 0) {
            input += 12;
            this.jYear(this.jYear() - 1);
        }
        g = toGregorian(this.jYear(), input, lastDay);
        setDate(this, g.gy, g.gm, g.gd);
        moment.updateOffset(this);
        return this;
    } else {
        return getJalaliOf(this).jm;
    }
};

jMoment.fn.date = function (input) {
    if (isJalali(this)) return jMoment.fn.jDate.call(this,input);
    else return moment.fn.date.call(this, input);
};
function getJalaliOf (momentObj) {
    var d = momentObj._d;
    if (momentObj._isUTC) {
        return toJalali(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    } else {
        return toJalali(d.getFullYear(), d.getMonth(), d.getDate());
    }
}
jMoment.fn.jDate = function (input) {
    var j
        , g;
    if (typeof input === "number") {
        j = getJalaliOf(this);
        g = toGregorian(j.jy, j.jm, input);
        setDate(this, g.gy, g.gm, g.gd);
        moment.updateOffset(this);
        return this;
    } else {
        return getJalaliOf(this).jd;
    }
};

jMoment.fn.jDay = function (input) {
    if (typeof input === "number") {
        return moment.fn.day.call(this, input - 1);
    } else {
        return (moment.fn.day.call(this) + 1) % 7;
    }
};
jMoment.fn.diff = function (input, unitOfTime, asFloat) {
    //code taken and adjusted for jalali calendar from original moment diff module https://github.com/moment/moment/blob/develop/src/lib/moment/diff.js
    if (!isJalali(this))
        return moment.fn.diff.call(this, input, unitOfTime, asFloat);

    var output;
    switch (unitOfTime) {
        case "year":
            output = monthDiff(this, input) / 12;
            break;
        case "month":
            output = monthDiff(this, input);
            break;
        case "quarter":
            output = monthDiff(this, input) / 3;
            break;
        default:
            output = moment.fn.diff.call(this, input, unitOfTime, asFloat);
    }

    return asFloat ? output : (output < 0 ? Math.ceil(output) || 0 : Math.floor(output));

    function monthDiff(a, b) {
        if (a.date() < b.date()) {
            // end-of-month calculations work correct when the start month has more
            // days than the end month.
            return -monthDiff(b, a);
        }
        // difference in months
        var wholeMonthDiff = (b.jYear() - a.jYear()) * 12 + (b.jMonth() - a.jMonth()),
            // b is in (anchor - 1 month, anchor + 1 month)
            anchor = a.clone().add(wholeMonthDiff, "months"),
            anchor2,
            adjust

        if (b - anchor < 0) {
            anchor2 = a.clone().add(wholeMonthDiff - 1, "months");
            // linear across the month
            adjust = (b - anchor) / (anchor - anchor2);
        } else {
            anchor2 = a.clone().add(wholeMonthDiff + 1, "months");
            // linear across the month
            adjust = (b - anchor) / (anchor2 - anchor);
        }

        //check for negative zero, return zero if negative zero
        return -(wholeMonthDiff + adjust) || 0;
    }
}

jMoment.fn.dayOfYear = function (input) {
    if (isJalali(this)) return jMoment.fn.jDayOfYear.call(this,input);
    else return moment.fn.dayOfYear.call(this, input);
};
jMoment.fn.jDayOfYear = function (input) {
    var dayOfYear = Math.round((jMoment(this).startOf("day") - jMoment(this).startOf("jYear")) / 864e5) + 1;
    return isNull(input) ? dayOfYear : this.add(input - dayOfYear, "d");
};

jMoment.fn.week = function (input) {
    if (isJalali(this)) return jMoment.fn.jWeek.call(this,input);
    else return moment.fn.week.call(this, input);
};
jMoment.fn.jWeek = function (input) {
    var week = jWeekOfYear(this, 6, 12).week;
    return isNull(input) ? week : this.add((input - week) * 7, "d");
};

jMoment.fn.weekYear = function (input) {
    if (isJalali(this)) return jMoment.fn.jWeekYear.call(this,input);
    else return moment.fn.weekYear.call(this, input);
};
jMoment.fn.jWeekYear = function (input) {
    var year = jWeekOfYear(this, 6, 12).year;
    return isNull(input) ? year : this.add(input - year, "jyear");
};

jMoment.fn.add = function (val, units) {
    var temp;
    if (!isNull(units) && !isNaN(+units)) {
        temp = val;
        val = units;
        units = temp;
    }
    units = normalizeUnits(units, this);
    if (units === 'jweek' || units==='isoweek') { units = 'week' }
    if (units === "jyear") {
        this.jYear(this.jYear() + val);
    } else if (units === "jmonth") {
        this.jMonth(this.jMonth() + val);
    } else {
        moment.fn.add.call(this, val, units);
    }
    return this;
};

jMoment.fn.subtract = function (val, units) {
    var temp;
    if (!isNull(units) && !isNaN(+units)) {
        temp = val;
        val = units;
        units = temp;
    }
    units = normalizeUnits(units, this);
    if (units === "jyear") {
        this.jYear(this.jYear() - val);
    } else if (units === "jmonth") {
        this.jMonth(this.jMonth() - val);
    } else {
        moment.fn.subtract.call(this, val, units);
    }
    return this;
};

jMoment.fn.startOf = function (units) {
    var nunit = normalizeUnits(units, this);
    if( nunit === "jweek"){
        return this.startOf("day").subtract(this.jDay() , "day");
    }
    if (nunit === "jyear") {
        this.jMonth(0);
        nunit = "jmonth";
    }
    if (nunit === "jmonth") {
        this.jDate(1);
        nunit = "day";
    }
    if (nunit === "day") {
        this.hours(0);
        this.minutes(0);
        this.seconds(0);
        this.milliseconds(0);
        return this;
    } else {
        return moment.fn.startOf.call(this, units);
    }
};

jMoment.fn.endOf = function (units) {
    units = normalizeUnits(units, this);
    if (units === undefined || units === "milisecond") {
        return this;
    }
    return this.startOf(units).add(1, units).subtract(1, "ms");
};

jMoment.fn.isSame = function (other, units) {
    units = normalizeUnits(units, this);
    if (units === "jyear" || units === "jmonth") {
        return moment.fn.isSame.call(this.clone().startOf(units), other.clone().startOf(units));
    }
    return moment.fn.isSame.call(this, other, units);
};

jMoment.fn.isBefore = function (other, units) {
    units = normalizeUnits(units, this);
    if (units === "jyear" || units === "jmonth") {
        return moment.fn.isBefore.call(this.clone().startOf(units), other.clone().startOf(units));
    }
    return moment.fn.isBefore.call(this, other, units);
};

jMoment.fn.isAfter = function (other, units) {
    units = normalizeUnits(units, this);
    if (units === "jyear" || units === "jmonth") {
        return moment.fn.isAfter.call(this.clone().startOf(units), other.clone().startOf(units));
    }
    return moment.fn.isAfter.call(this, other, units);
};

jMoment.fn.clone = function () {
    return jMoment(this);
};

jMoment.fn.doAsJalali = function () {
    this.calSystem = CalendarSystems.Jalali;
    return this;
};
jMoment.fn.doAsGregorian = function () {
    this.calSystem = CalendarSystems.Gregorian;
    return this;
};

jMoment.fn.jYears = jMoment.fn.jYear;
jMoment.fn.jMonths = jMoment.fn.jMonth;
jMoment.fn.jDates = jMoment.fn.jDate;
jMoment.fn.jWeeks = jMoment.fn.jWeek;

jMoment.fn.daysInMonth = function() {
    if (isJalali(this)) {
        return this.jDaysInMonth();
    }
    return moment.fn.daysInMonth.call(this);
};
jMoment.fn.jDaysInMonth = function () {
    var month = this.jMonth();
    var year = this.jYear();
    if (month < 6) {
        return 31;
    } else if (month < 11) {
        return 30;
    } else if (jMoment.jIsLeapYear(year)) {
        return 30;
    } else {
        return 29;
    }
};

jMoment.fn.isLeapYear = function() {
    if (isJalali(this)) {
        return this.jIsLeapYear();
    }
    return moment.fn.isLeapYear.call(this);
};
jMoment.fn.jIsLeapYear = function () {
    var year = this.jYear();
    return isLeapJalaliYear(year);
};
jMoment.fn.locale = function(locale) {
    if (locale && moment.changeCalendarSystemByItsLocale) {
        if (locale === "fa") {
            this.doAsJalali();
        } else {
            this.doAsGregorian();
        }
    }
    return moment.fn.locale.call(this, locale);
};
/************************************
 jMoment Statics
 ************************************/
jMoment.locale = function(locale, options) {
    if (locale && moment.changeCalendarSystemByItsLocale) {
        if (locale === "fa") {
            this.useJalaliSystemPrimarily(options);
        } else {
            this.useJalaliSystemSecondary();
        }
    }
    return moment.locale.call(this, locale);
};

jMoment.from = function(date, locale, format) {
    var lastLocale = jMoment.locale();
    jMoment.locale(locale);
    var m = jMoment(date, format);
    m.locale(lastLocale);
    jMoment.locale(lastLocale);
    return m;
};

jMoment.bindCalendarSystemAndLocale = function () {
    moment.changeCalendarSystemByItsLocale = true;
};
jMoment.unBindCalendarSystemAndLocale = function () {
    moment.changeCalendarSystemByItsLocale = false;
};

jMoment.useJalaliSystemPrimarily = function (options) {
    moment.justUseJalali = true;
    var useGregorianParser = false;
    if (options) {
        useGregorianParser = options.useGregorianParser;
    }
    moment.useGregorianParser = useGregorianParser;
};
jMoment.useJalaliSystemSecondary = function () {
    moment.justUseJalali = false;
};

jMoment.jDaysInMonth = function (year, month) {
    year += div(month, 12);
    month = mod(month, 12);
    if (month < 0) {
        month += 12;
        year -= 1;
    }
    if (month < 6) {
        return 31;
    } else if (month < 11) {
        return 30;
    } else if (jMoment.jIsLeapYear(year)) {
        return 30;
    } else {
        return 29;
    }
};

jMoment.jIsLeapYear = isLeapJalaliYear;

moment.updateLocale("fa", {
        months: ("ژانویه_فوریه_مارس_آوریل_مه_ژوئن_ژوئیه_اوت_سپتامبر_اکتبر_نوامبر_دسامبر").split("_")
        , monthsShort: ("ژانویه_فوریه_مارس_آوریل_مه_ژوئن_ژوئیه_اوت_سپتامبر_اکتبر_نوامبر_دسامبر").split("_")
        , weekdays: ("یک\u200cشنبه_دوشنبه_سه\u200cشنبه_چهارشنبه_پنج\u200cشنبه_جمعه_شنبه").split("_")
        , weekdaysShort: ("یک\u200cشنبه_دوشنبه_سه\u200cشنبه_چهارشنبه_پنج\u200cشنبه_جمعه_شنبه").split("_")
        , weekdaysMin: "ی_د_س_چ_پ_ج_ش".split("_")
        , longDateFormat:
            { LT: "HH:mm"
                , L: "jYYYY/jMM/jDD"
                , LL: "jD jMMMM jYYYY"
                , LLL: "jD jMMMM jYYYY LT"
                , LLLL: "dddd، jD jMMMM jYYYY LT"
            }
        , calendar:
            { sameDay: "[امروز ساعت] LT"
                , nextDay: "[فردا ساعت] LT"
                , nextWeek: "dddd [ساعت] LT"
                , lastDay: "[دیروز ساعت] LT"
                , lastWeek: "dddd [ی پیش ساعت] LT"
                , sameElse: "L"
            }
        , relativeTime:
            { future: "در %s"
                , past: "%s پیش"
                , s: "چند ثانیه"
                , m: "1 دقیقه"
                , mm: "%d دقیقه"
                , h: "1 ساعت"
                , hh: "%d ساعت"
                , d: "1 روز"
                , dd: "%d روز"
                , M: "1 ماه"
                , MM: "%d ماه"
                , y: "1 سال"
                , yy: "%d سال"
            }
        , ordinal: "%dم",
        preparse: function (string) {
            return string;
        },
        postformat: function (string) {
            return string;
        }
        , week:
            { dow: 6 // Saturday is the first day of the week.
                , doy: 12 // The week that contains Jan 1st is the first week of the year.
            }
        , meridiem: function (hour) {
            return hour < 12 ? "ق.ظ" : "ب.ظ";
        }
        , jMonths: ("فروردین_اردیبهشت_خرداد_تیر_مرداد_شهریور_مهر_آبان_آذر_دی_بهمن_اسفند").split("_")
        , jMonthsShort: "فروردین_اردیبهشت_خرداد_تیر_مرداد_شهریور_مهر_آبان_آذر_دی_بهمن_اسفند".split("_")
    });
moment.updateLocale("fa-af", {
        months: ("جنوری_فبروری_مارچ_اپریل_می_جون_جولای_آگست_سپتمبر_اکتوبر_نومبر_دیسمبر").split("_")
        , monthsShort: ("جنوری_فبروری_مارچ_اپریل_می_جون_جولای_آگست_سپتمبر_اکتوبر_نومبر_دیسمبر").split("_")
        , weekdays: ("یک\u200cشنبه_دوشنبه_سه\u200cشنبه_چهارشنبه_پنج\u200cشنبه_جمعه_شنبه").split("_")
        , weekdaysShort: ("یک\u200cشنبه_دوشنبه_سه\u200cشنبه_چهارشنبه_پنج\u200cشنبه_جمعه_شنبه").split("_")
        , weekdaysMin: "ی_د_س_چ_پ_ج_ش".split("_")
        , longDateFormat:
            { LT: "HH:mm"
                , L: "jYYYY/jMM/jDD"
                , LL: "jD jMMMM jYYYY"
                , LLL: "jD jMMMM jYYYY LT"
                , LLLL: "dddd، jD jMMMM jYYYY LT"
            }
        , calendar:
            { sameDay: "[امروز ساعت] LT"
                , nextDay: "[فردا ساعت] LT"
                , nextWeek: "dddd [ساعت] LT"
                , lastDay: "[دیروز ساعت] LT"
                , lastWeek: "dddd [ی پیش ساعت] LT"
                , sameElse: "L"
            }
        , relativeTime:
            { future: "در %s"
                , past: "%s پیش"
                , s: "چند ثانیه"
                , m: "1 دقیقه"
                , mm: "%d دقیقه"
                , h: "1 ساعت"
                , hh: "%d ساعت"
                , d: "1 روز"
                , dd: "%d روز"
                , M: "1 ماه"
                , MM: "%d ماه"
                , y: "1 سال"
                , yy: "%d سال"
            }
        , ordinal: "%dم",
        preparse: function (string) {
            return string;
        },
        postformat: function (string) {
            return string;
        }
        , week:
            { dow: 6 // Saturday is the first day of the week.
                , doy: 12 // The week that contains Jan 1st is the first week of the year.
            }
        , meridiem: function (hour) {
            return hour < 12 ? "ق.ظ" : "ب.ظ";
        }
        , jMonths: ("حمل_ثور_جوزا_سرطان_اسد_سنبله_میزان_عقرب_قوس_جدی_دلو_حوت").split("_")
        , jMonthsShort: "حمل_ثور_جوزا_سرطان_اسد_سنبله_میزان_عقرب_قوس_جدی_دلو_حوت".split("_")
    });
moment.updateLocale("ps-af", {
        months: ("جنوری_فبروری_مارچ_اپریل_می_جون_جولای_آگست_سپتمبر_اکتوبر_نومبر_دیسمبر").split("_")
        , monthsShort: ("جنوری_فبروری_مارچ_اپریل_می_جون_جولای_آگست_سپتمبر_اکتوبر_نومبر_دیسمبر").split("_")
        , weekdays: ("یک\u200cشنبه_دوشنبه_سه\u200cشنبه_چهارشنبه_پنج\u200cشنبه_جمعه_شنبه").split("_")
        , weekdaysShort: ("یک\u200cشنبه_دوشنبه_سه\u200cشنبه_چهارشنبه_پنج\u200cشنبه_جمعه_شنبه").split("_")
        , weekdaysMin: "ی_د_س_چ_پ_ج_ش".split("_")
        , longDateFormat:
            { LT: "HH:mm"
                , L: "jYYYY/jMM/jDD"
                , LL: "jD jMMMM jYYYY"
                , LLL: "jD jMMMM jYYYY LT"
                , LLLL: "dddd، jD jMMMM jYYYY LT"
            }
        , calendar:
            { sameDay: "[امروز ساعت] LT"
                , nextDay: "[فردا ساعت] LT"
                , nextWeek: "dddd [ساعت] LT"
                , lastDay: "[دیروز ساعت] LT"
                , lastWeek: "dddd [ی پیش ساعت] LT"
                , sameElse: "L"
            }
        , relativeTime:
            { future: "در %s"
                , past: "%s پیش"
                , s: "چند ثانیه"
                , m: "1 دقیقه"
                , mm: "%d دقیقه"
                , h: "1 ساعت"
                , hh: "%d ساعت"
                , d: "1 روز"
                , dd: "%d روز"
                , M: "1 ماه"
                , MM: "%d ماه"
                , y: "1 سال"
                , yy: "%d سال"
            }
        , ordinal: "%dم",
        preparse: function (string) {
            return string;
        },
        postformat: function (string) {
            return string;
        }
        , week:
            { dow: 6 // Saturday is the first day of the week.
                , doy: 12 // The week that contains Jan 1st is the first week of the year.
            }
        , meridiem: function (hour) {
            return hour < 12 ? "غ.م" : "غ.و";
        }
        , jMonths: ("وری_غویی_غبرګولی_چنګاښ_زمری_وږی_تله_لړم_لیندی_مرغومی_سلواغه_کب").split("_")
        , jMonthsShort: "وری_غویی_غبرګولی_چنګاښ_زمری_وږی_تله_لړم_لیندی_مرغومی_سلواغه_کب".split("_")
    });
jMoment.bindCalendarSystemAndLocale();
moment.locale("en");

jMoment.jConvert =  { toJalali: toJalali
    , toGregorian: toGregorian
};

/************************************
 Jalali Conversion
 ************************************/

function toJalali(gy, gm, gd) {
    var j = convertToJalali(gy, gm + 1, gd);
    j.jm -= 1;
    return j;
}

function toGregorian(jy, jm, jd) {
    var g = convertToGregorian(jy, jm + 1, jd);
    g.gm -= 1;
    return g;
}

/*
 Utility helper functions.
 */

function div(a, b) {
    return ~~(a / b);
}

function mod(a, b) {
    return a - ~~(a / b) * b;
}

/*
 Converts a Gregorian date to Jalali.
 */
function convertToJalali(gy, gm, gd) {
    if (Object.prototype.toString.call(gy) === "[object Date]") {
        gd = gy.getDate();
        gm = gy.getMonth() + 1;
        gy = gy.getFullYear();
    }
    return d2j(g2d(gy, gm, gd));
}

/*
 Converts a Jalali date to Gregorian.
 */
function convertToGregorian(jy, jm, jd) {
    return d2g(j2d(jy, jm, jd));
}

/*
 Is this a leap year or not?
 */
function isLeapJalaliYear(jy) {
    return jalCal(jy).leap === 0;
}

/*
 This function determines if the Jalali (Persian) year is
 leap (366-day long) or is the common year (365 days), and
 finds the day in March (Gregorian calendar) of the first
 day of the Jalali year (jy).
 @param jy Jalali calendar year (-61 to 3177)
 @return
 leap: number of years since the last leap year (0 to 4)
 gy: Gregorian year of the beginning of Jalali year
 march: the March day of Farvardin the 1st (1st day of jy)
 @see: http://www.astro.uni.torun.pl/~kb/Papers/EMP/PersianC-EMP.htm
 @see: http://www.fourmilab.ch/documents/calendar/
 */
function jalCal(jy) {
    // Jalali years starting the 33-year rule.
    var breaks =  [ -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210
        , 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178
    ]
        , bl = breaks.length
        , gy = jy + 621
        , leapJ = -14
        , jp = breaks[0]
        , jm
        , jump
        , leap
        , leapG
        , march
        , n
        , i;

    if (jy < jp || jy >= breaks[bl - 1])
        throw new Error("Invalid Jalali year " + jy);

    // Find the limiting years for the Jalali year jy.
    for (i = 1; i < bl; i += 1) {
        jm = breaks[i];
        jump = jm - jp;
        if (jy < jm)
            break;
        leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
        jp = jm;
    }
    n = jy - jp;

    // Find the number of leap years from AD 621 to the beginning
    // of the current Jalali year in the Persian calendar.
    leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
    if (mod(jump, 33) === 4 && jump - n === 4)
        leapJ += 1;

    // And the same in the Gregorian calendar (until the year gy).
    leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;

    // Determine the Gregorian date of Farvardin the 1st.
    march = 20 + leapJ - leapG;

    // Find how many years have passed since the last leap year.
    if (jump - n < 6)
        n = n - jump + div(jump + 4, 33) * 33;
    leap = mod(mod(n + 1, 33) - 1, 4);
    if (leap === -1) {
        leap = 4;
    }

    return  { leap: leap
        , gy: gy
        , march: march
    };
}

/*
 Converts a date of the Jalali calendar to the Julian Day number.
 @param jy Jalali year (1 to 3100)
 @param jm Jalali month (1 to 12)
 @param jd Jalali day (1 to 29/31)
 @return Julian Day number
 */
function j2d(jy, jm, jd) {
    var r = jalCal(jy);
    return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}

/*
 Converts the Julian Day number to a date in the Jalali calendar.
 @param jdn Julian Day number
 @return
 jy: Jalali year (1 to 3100)
 jm: Jalali month (1 to 12)
 jd: Jalali day (1 to 29/31)
 */
function d2j(jdn) {
    var gy = d2g(jdn).gy // Calculate Gregorian year (gy).
        , jy = gy - 621
        , r = jalCal(jy)
        , jdn1f = g2d(gy, 3, r.march)
        , jd
        , jm
        , k;

    // Find number of days that passed since 1 Farvardin.
    k = jdn - jdn1f;
    if (k >= 0) {
        if (k <= 185) {
            // The first 6 months.
            jm = 1 + div(k, 31);
            jd = mod(k, 31) + 1;
            return  { jy: jy
                , jm: jm
                , jd: jd
            };
        } else {
            // The remaining months.
            k -= 186;
        }
    } else {
        // Previous Jalali year.
        jy -= 1;
        k += 179;
        if (r.leap === 1)
            k += 1;
    }
    jm = 7 + div(k, 30);
    jd = mod(k, 30) + 1;
    return  { jy: jy
        , jm: jm
        , jd: jd
    };
}

/*
 Calculates the Julian Day number from Gregorian or Julian
 calendar dates. This integer number corresponds to the noon of
 the date (i.e. 12 hours of Universal Time).
 The procedure was tested to be good since 1 March, -100100 (of both
 calendars) up to a few million years into the future.
 @param gy Calendar year (years BC numbered 0, -1, -2, ...)
 @param gm Calendar month (1 to 12)
 @param gd Calendar day of the month (1 to 28/29/30/31)
 @return Julian Day number
 */
function g2d(gy, gm, gd) {
    var d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4)
        + div(153 * mod(gm + 9, 12) + 2, 5)
        + gd - 34840408;
    d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
    return d;
}

/*
 Calculates Gregorian and Julian calendar dates from the Julian Day number
 (jdn) for the period since jdn=-34839655 (i.e. the year -100100 of both
 calendars) to some millions years ahead of the present.
 @param jdn Julian Day number
 @return
 gy: Calendar year (years BC numbered 0, -1, -2, ...)
 gm: Calendar month (1 to 12)
 gd: Calendar day of the month M (1 to 28/29/30/31)
 */
function d2g(jdn) {
    var j
        , i
        , gd
        , gm
        , gy;
    j = 4 * jdn + 139361631;
    j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
    i = div(mod(j, 1461), 4) * 5 + 308;
    gd = div(mod(i, 153), 5) + 1;
    gm = mod(div(i, 153), 12) + 1;
    gy = div(j, 1461) - 100100 + div(8 - gm, 6);
    return  { gy: gy
        , gm: gm
        , gd: gd
    };
}
