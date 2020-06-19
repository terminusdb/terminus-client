const WOQLQuery = require('./woqlCore')
const UTILS = require('../utils')
/**
 * The WOQL Schema Class provides pre-built WOQL queries for schema manipulation
 * a) adding and deleting classes and properties
 * b) loading datatype libraries
 * c) boxing classes
 */
function WOQLSchema(g) {
    this.graph = g || 'schema/main'
}

/**
 * Add a class (id c) to the schema
 *
 * @param {string} c - class ID
 * @param {string} [graph] - schema graph identifier
 * @returns WOQLQuery object
 */
WOQLSchema.prototype.add_class = function(c, graph) {
    graph = graph || this.graph
    let ap = new WOQLQuery()
    if (c) {
        c = ap.cleanClass(c, true)
        let ret = new WOQLQuery().add_quad(c, 'rdf:type', 'owl:Class', graph)
        ret._set_adding_class(c)
        return ret
    }
    return ap
}

/**
 * Adds a bunch of class data in one go
 * @param {data} json with id, label, description, parent and properties
 */

WOQLSchema.prototype.insert_class_data = function(data, refGraph) {
    let ap = new WOQLQuery()
    if (data.id) {
        c = ap.cleanClass(data.id, true)
        ap = new WOQLSchema().add_class(c, refGraph)
        if (data.label) {
            ap.label(data.label)
        }
        if (data.description) {
            ap.description(data.description)
        }
        if (data.parent) {
            if (!Array.isArray(data.parent)) data.parent = [data.parent]
            ap.parent(...data.parent)
        }
        for (var k in data) {
            if (['id', 'label', 'description', 'parent'].indexOf(k) == -1) {
                ap.insert_property_data(k, data[k], refGraph)
            }
        }
    }
    return ap
}

WOQLSchema.prototype.doctype_data = function(data, refGraph) {
    if (!data.parent) data.parent = []
    if (!Array.isArray(data.parent)) data.parent = [data.parent]
    data.parent.push('Document')
    return this.insert_class_data(data, refGraph)
}

WOQLSchema.prototype.insert_property_data = function(propid, data, graph) {
    let ap = new WOQLQuery()
    if (data.id) {
        c = ap.cleanClass(data.id, true)
        ap.add_class(c, refGraph)
        if (data.label) {
            ap.label(data.label)
        }
        if (data.description) {
            ap.description(data.description)
        }
        if (data.parent) {
            if (!Array.isArray(data.parent)) data.parent = [data.parent]
            ap.parent(...data.parent)
        }
        for (var k in data) {
            if (['id', 'label', 'description', 'parent'].indexOf(k) == -1) {
                ap.insert_property_data(k, data[k], refGraph)
            }
        }
    }
    return ap
}

/**
 * Add a property to the schema
 *
 * @param {string} p - property ID
 * @param {string} t - property type (range)
 * @param {string} [graph] - graph identifier
 * @returns WOQLQuery object
 */
WOQLSchema.prototype.add_property = function(p, t, graph) {
    let ap = new WOQLQuery()
    t = t ? ap.cleanType(t, true) : 'xsd:string'
    graph = graph || this.graph
    if (p) {
        p = ap.cleanPathPredicate(p)
        if (UTILS.TypeHelper.isDatatype(t)) {
            ap.and(
                new WOQLQuery().add_quad(p, 'rdf:type', 'owl:DatatypeProperty', graph),
                new WOQLQuery().add_quad(p, 'rdfs:range', t, graph),
            )
        } else {
            ap.and(
                new WOQLQuery().add_quad(p, 'rdf:type', 'owl:ObjectProperty', graph),
                new WOQLQuery().add_quad(p, 'rdfs:range', t, graph),
            )
        }
        ap.updated()
    }
    return ap
}

WOQLSchema.prototype.insert_property_data = function(data, graph) {
    let ap = new WOQLQuery()
    if (data.id) {
        p = ap.cleanPathPredicate(data.id)
        t = data.range ? ap.cleanType(data.range, true) : 'xsd:string'
        ap.add_property(p, t, graph)
        if (data.label) {
            ap.label(data.label)
        }
        if (data.description) {
            ap.description(data.description)
        }
        if (data.domain) {
            ap.domain(data.domain)
        }
        if (data.max) ap.max(data.max)
        if (data.min) ap.min(data.min)
        if (data.cardinality) ap.cardinality(data.cardinality)
    }
    return ap
}

/**
 * Generates a class representing a choice list - an enumerated list of specific options
 * @param {string} cls - the id of the choice list class
 * @param {string} clslabel - the name of the class
 * @param {string} [clsdesc] - description of the class
 * @param {Array} choices - an array of choices, with each entry being an array ["choiceid", "choice label", "choice description"]
 * @param {string} graph - the id of the graph that the choice list will be written to
 * @param {string} parent - the id of a class that this class inherits from (e.g. scm:Enumerated)
 */
WOQLSchema.prototype.generateChoiceList = function(cls, clslabel, clsdesc, choices, graph, parent) {
    graph = graph || this.graph
    var clist = []
    var listid = '_:' + (cls.indexOf(':') == -1 ? cls : cls.split(':')[1])
    var lastid = listid
    let wq = new WOQLSchema().add_class(cls, graph).label(clslabel)
    if (clsdesc) wq.description(clsdesc)
    if (parent) wq.parent(parent)
    var confs = [wq]
    for (var i = 0; i < choices.length; i++) {
        if (!choices[i]) continue
        if (Array.isArray(choices[i])) {
            var chid = choices[i][0]
            var clab = choices[i][1]
            var desc = choices[i][2] || false
        } else {
            var chid = choices[i]
            var clab = UTILS.labelFromURL(chid)
            var desc = false
        }
        let cq = new WOQLQuery().insert(chid, cls, graph).label(clab)
        if (desc) cq.description(desc)
        confs.push(cq)
        var nextid = i < choices.length - 1 ? listid + '_' + i : 'rdf:nil'
        clist.push(new WOQLQuery().add_quad(lastid, 'rdf:first', chid, graph))
        clist.push(new WOQLQuery().add_quad(lastid, 'rdf:rest', nextid, graph))
        lastid = nextid
    }
    //do the owl oneof
    let oneof = new WOQLQuery().and(
        new WOQLQuery().add_quad(cls, 'owl:oneOf', listid, graph),
        ...clist,
    )
    return new WOQLQuery().and(...confs, oneof)
}

/**
 * Adds the xdd datataypes to the graph
 */
WOQLSchema.prototype.loadXDD = function(graph) {
    graph = graph || this.graph
    return new WOQLQuery().and(
        //geograhpic datatypes
        this.addDatatype(
            'xdd:coordinate',
            'Coordinate',
            'A latitude / longitude pair making up a coordinate, encoded as: [lat,long]',
            graph,
        ),
        this.addDatatype(
            'xdd:coordinatePolygon',
            'Coordinate Polygon',
            'A JSON list of [[lat,long]] coordinates forming a closed polygon.',
            graph,
        ),
        this.addDatatype(
            'xdd:coordinatePolyline',
            'Coordinate Polyline',
            'A JSON list of [[lat,long]] coordinates interpreted as a .',
            graph,
        ),

        //uncertainty range datatypes
        this.addDatatype(
            'xdd:dateRange',
            'Date Range',
            'A date (YYYY-MM-DD) or an uncertain date range [YYYY-MM-DD1,YYYY-MM-DD2]. ' +
                'Enables uncertainty to be encoded directly in the data',
            graph,
        ),
        this.addDatatype(
            'xdd:decimalRange',
            'Decimal Range',
            'Either a decimal value (e.g. 23.34) or an uncertain range of decimal values ' +
                '(e.g.[23.4, 4.143]. Enables uncertainty to be encoded directly in the data',
            graph,
        ),
        this.addDatatype(
            'xdd:integerRange',
            'Integer Range',
            'Either an integer (e.g. 30) or an uncertain range of integers [28,30]. ' +
                'Enables uncertainty to be encoded directly in the data',
            graph,
        ),
        this.addDatatype(
            'xdd:gYearRange',
            'Year Range',
            'A year (e.g. 1999) or an uncertain range of years: (e.g. [1999,2001]).' +
                'Enables uncertainty to be encoded directly in the data',
            graph,
        ),

        //string refinement datatypes
        this.addDatatype('xdd:email', 'Email', 'A valid email address', graph),
        this.addDatatype('xdd:html', 'HTML', 'A string with embedded HTML', graph),
        this.addDatatype('xdd:json', 'JSON', 'A JSON encoded string', graph),
        this.addDatatype('xdd:url', 'URL', 'A valid http(s) URL', graph),
    )
}

/* utility function for creating a datatype in woql */
WOQLSchema.prototype.addDatatype = function(id, label, descr, graph) {
    graph = graph || this.graph
    var dt = new WOQLQuery().insert(id, 'rdfs:Datatype', graph).label(label)
    if (descr) dt.description(descr)
    return dt
}

/**
 * Loads box classes for all of the useful xsd classes the format is to generate the box classes for xsd:anyGivenType
 * as class(prefix:AnyGivenType) -> property(prefix:anyGivenType) -> datatype(xsd:anyGivenType)
 */
WOQLSchema.prototype.loadXSDBoxes = function(parent, graph, prefix) {
    return new WOQLQuery().and(
        this.boxDatatype(
            'xsd:anySimpleType',
            'Any Simple Type',
            'Any basic data type such as string or integer. An xsd:anySimpleType value.',
            parent,
            graph,
            prefix,
        ),
        this.boxDatatype(
            'xsd:string',
            'String',
            'Any text or sequence of characters',
            parent,
            graph,
            prefix,
        ),
        this.boxDatatype(
            'xsd:boolean',
            'Boolean',
            'A true or false value. An xsd:boolean value.',
            parent,
            graph,
            prefix,
        ),
        this.boxDatatype(
            'xsd:decimal',
            'Decimal',
            'A decimal number. An xsd:decimal value.',
            parent,
            graph,
            prefix,
        ),
        this.boxDatatype(
            'xsd:double',
            'Double',
            'A double-precision decimal number. An xsd:double value.',
            parent,
            graph,
            prefix,
        ),
        this.boxDatatype(
            'xsd:float',
            'Float',
            'A floating-point number. An xsd:float value.',
            parent,
            graph,
            prefix,
        ),
        this.boxDatatype(
            'xsd:time',
            'Time',
            'A time. An xsd:time value. hh:mm:ss.ssss',
            parent,
            graph,
            prefix,
        ),
        this.boxDatatype(
            'xsd:date',
            'Date',
            'A date. An xsd:date value. YYYY-MM-DD',
            parent,
            graph,
            prefix,
        ),
        this.boxDatatype(
            'xsd:dateTime',
            'Date Time',
            'A date and time. An xsd:dateTime value.',
            parent,
            graph,
            prefix,
        ),
        this.boxDatatype(
            'xsd:dateTimeStamp',
            'Date-Time Stamp',
            'An xsd:dateTimeStamp value.',
            parent,
            graph,
            prefix,
        ),
        this.boxDatatype(
            'xsd:gYear',
            'Year',
            ' A particular 4 digit year YYYY - negative years are BCE.',
            parent,
            graph,
            prefix,
        ),
        this.boxDatatype(
            'xsd:gMonth',
            'Month',
            'A particular month. An xsd:gMonth value. --MM',
            parent,
            graph,
            prefix,
        ),
        this.boxDatatype(
            'xsd:gDay',
            'Day',
            'A particular day. An xsd:gDay value. ---DD',
            parent,
            graph,
            prefix,
        ),
        this.boxDatatype(
            'xsd:gYearMonth',
            'Year / Month',
            'A year and a month. An xsd:gYearMonth value.',
            parent,
            graph,
            prefix,
        ),
        this.boxDatatype(
            'xsd:gMonthDay',
            'Month / Day',
            'A month and a day. An xsd:gMonthDay value.',
            parent,
            graph,
            prefix,
        ),
        this.boxDatatype(
            'xsd:duration',
            'Duration',
            'A period of time. An xsd:duration value.',
            parent,
            graph,
            prefix,
        ),
        this.boxDatatype(
            'xsd:yearMonthDuration',
            'Year / Month Duration',
            'A duration measured in years and months. An xsd:yearMonthDuration value.',
            parent,
            graph,
            prefix,
        ),
        this.boxDatatype(
            'xsd:dayTimeDuration',
            'Day / Time Duration',
            'A duration measured in days and time. An xsd:dayTimeDuration value.',
            parent,
            graph,
            prefix,
        ),
        this.boxDatatype('xsd:byte', 'Byte', 'An xsd:byte value.', parent, graph, prefix),
        this.boxDatatype('xsd:short', 'Short', 'An xsd:short value.', parent, graph, prefix),
        this.boxDatatype(
            'xsd:integer',
            'Integer',
            'A simple number. An xsd:integer value.',
            parent,
            graph,
            prefix,
        ),
        this.boxDatatype('xsd:long', 'Long', 'An xsd:long value.', parent, graph, prefix),
        this.boxDatatype(
            'xsd:unsignedByte',
            'Unsigned Byte',
            'An xsd:unsignedByte value.',
            parent,
            graph,
            prefix,
        ),
        this.boxDatatype(
            'xsd:unsignedInt',
            'Unsigned Integer',
            'An xsd:unsignedInt value.',
            parent,
            graph,
            prefix,
        ),
        this.boxDatatype(
            'xsd:unsignedLong',
            'Unsigned Long Integer',
            'An xsd:unsignedLong value.',
            parent,
            graph,
            prefix,
        ),
        this.boxDatatype(
            'xsd:positiveInteger',
            'Positive Integer',
            'A simple number greater than 0. An xsd:positiveInteger value.',
            parent,
            graph,
            prefix,
        ),
        this.boxDatatype(
            'xsd:nonNegativeInteger',
            'Non-Negative Integer',
            "A simple number that can't be less than 0. An xsd:nonNegativeInteger value.",
            parent,
            graph,
            prefix,
        ),
        this.boxDatatype(
            'xsd:negativeInteger',
            'Negative Integer',
            'A negative integer. An xsd:negativeInteger value.',
            parent,
            graph,
            prefix,
        ),
        this.boxDatatype(
            'xsd:nonPositiveInteger',
            'Non-Positive Integer',
            'A number less than or equal to zero. An xsd:nonPositiveInteger value.',
            parent,
            graph,
            prefix,
        ),
        this.boxDatatype(
            'xsd:base64Binary',
            'Base 64 Binary',
            'An xsd:base64Binary value.',
            parent,
            graph,
            prefix,
        ),
        this.boxDatatype(
            'xsd:anyURI',
            'Any URI',
            'Any URl. An xsd:anyURI value.',
            parent,
            graph,
            prefix,
        ),
        this.boxDatatype(
            'xsd:language',
            'Language',
            'A natural language identifier as defined by by [RFC 3066] . An xsd:language value.',
            parent,
            graph,
            prefix,
        ),
        this.boxDatatype(
            'xsd:normalizedString',
            'Normalized String',
            'An xsd:normalizedString value.',
            parent,
            graph,
            prefix,
        ),
        this.boxDatatype('xsd:token', 'Token', 'An xsd:token value.', parent, graph, prefix),
        this.boxDatatype('xsd:NMTOKEN', 'NMTOKEN', 'An xsd:NMTOKEN value.', parent, graph, prefix),
        this.boxDatatype('xsd:Name', 'Name', 'An xsd:Name value.', parent, graph, prefix),
        this.boxDatatype('xsd:NCName', 'NCName', 'An xsd:NCName value.', parent, graph, prefix),
        this.boxDatatype(
            'xsd:NOTATION',
            'NOTATION',
            'An xsd:NOTATION value.',
            parent,
            graph,
            prefix,
        ),
        this.boxDatatype('xsd:QName', 'QName', 'An xsd:QName value.', parent, graph, prefix),
        this.boxDatatype('xsd:ID', 'ID', 'An xsd:ID value.', parent, graph, prefix),
        this.boxDatatype('xsd:IDREF', 'IDREF', 'An xsd:IDREF value.', parent, graph, prefix),
        this.boxDatatype('xsd:ENTITY', 'ENTITY', 'An xsd:ENTITY value.', parent, graph, prefix),
    )
}

/**
 * Generates a query to create box classes for all of the xdd datatypes. the format is to generate the box classes for xdd:anyGivenType
 * as class(prefix:AnyGivenType) -> property(prefix:anyGivenType) -> datatype(xdd:anyGivenType)
 */
WOQLSchema.prototype.loadXDDBoxes = function(parent, graph, prefix) {
    return new WOQLQuery().and(
        this.boxDatatype(
            'xdd:coordinate',
            'Coordinate',
            'A particular location on the surface of the earth, defined by latitude and longitude . An xdd:coordinate value.',
            parent,
            graph,
            prefix,
        ),
        this.boxDatatype(
            'xdd:coordinatePolygon',
            'Geographic Area',
            'A shape on a map which defines an area. within the defined set of coordinates   An xdd:coordinatePolygon value.',
            parent,
            graph,
            prefix,
        ),
        this.boxDatatype(
            'xdd:coordinatePolyline',
            'Coordinate Path',
            'A set of coordinates forming a line on a map, representing a route. An xdd:coordinatePolyline value.',
            parent,
            graph,
            prefix,
        ),
        this.boxDatatype('xdd:url', 'URL', 'A valid url.', parent, graph, prefix),
        this.boxDatatype('xdd:email', 'Email', 'A valid email address.', parent, graph, prefix),
        this.boxDatatype('xdd:html', 'HTML', 'A safe HTML string', parent, graph, prefix),
        this.boxDatatype('xdd:json', 'JSON', 'A JSON Encoded String'),
        this.boxDatatype(
            'xdd:gYearRange',
            'Year',
            'A 4-digit year, YYYY, or if uncertain, a range of years. An xdd:gYearRange value.',
            parent,
            graph,
            prefix,
        ),
        this.boxDatatype(
            'xdd:integerRange',
            'Integer',
            'A simple number or range of numbers. An xdd:integerRange value.',
            parent,
            graph,
            prefix,
        ),
        this.boxDatatype(
            'xdd:decimalRange',
            'Decimal Number',
            'A decimal value or, if uncertain, a range of decimal values. An xdd:decimalRange value.',
            parent,
            graph,
            prefix,
        ),
        this.boxDatatype(
            'xdd:dateRange',
            'Date Range',
            'A date or a range of dates YYYY-MM-DD',
            parent,
            graph,
            prefix,
        ),
    )
}

/**
 *  utility function for boxing a datatype in woql
 * format is (predicate) prefix:datatype (domain) prefix:Datatype (range) xsd:datatype
 */
WOQLSchema.prototype.boxDatatype = function(datatype, label, descr, parent, graph, prefix) {
    graph = graph || this.graph
    prefix = prefix || 'scm:'
    let ext = datatype.split(':')[1]
    let box_class_id = prefix + ext.charAt(0).toUpperCase() + ext.slice(1)
    let box_prop_id = prefix + ext.charAt(0).toLowerCase() + ext.slice(1)
    var box_class = this.add_class(box_class_id, graph).label(label)
    box_class.description('Boxed Class for ' + datatype)
    if (parent) box_class.parent(parent)
    var box_prop = this.add_property(box_prop_id, datatype, graph)
        .label(label)
        .domain(box_class_id)
    if (descr) box_prop.description(descr)
    return new WOQLQuery().and(box_class, box_prop)
}

/**
 * Called to load Terminus Predefined libraries:
 * options are: xdd: extended datatypes, box: boxed datatypes
 */
WOQLSchema.prototype.libs = function(libs, parent, graph, prefix) {
    var bits = []
    if (libs.indexOf('xdd') != -1) {
        bits.push(this.loadXDD(graph))
        if (libs.indexOf('box') != -1) {
            bits.push(this.loadXDDBoxes(parent, graph, prefix))
            bits.push(this.loadXSDBoxes(parent, graph, prefix))
        }
    } else if (libs.indexOf('box') != -1) {
        bits.push(this.loadXSDBoxes(parent, graph, prefix))
    }
    if (bits.length > 1) return new WOQLQuery().and(...bits)
    return bits[0]
}

/*Below two probably contain embedded variable names, which should be removed*/

/**
 * Deletes a class from the schema
 *
 * @param {string} c - class ID
 * @param {string} [graph] - schema graph identifier
 * @returns WOQLQuery object
 */
WOQLSchema.prototype.delete_class = function(c, graph, cvar) {
    cvar = cvar || 'v:Class'
    return new WOQLQuery().and(new WOQLQuery().eq(c, cvar), this._nuke_schema_element(cvar, graph))
}

/**
 * Removes a property from the schema
 *
 * @param {string} p - property ID
 * @param {string} t - property type (range)
 * @param {string} [graph] - schema graph identifier
 * @returns WOQLQuery object
 */
WOQLSchema.prototype.delete_property = function(p, graph, propvar) {
    propvar = propvar || 'v:Property'
    return new WOQLQuery().and(new WOQLQuery().eq(p, propvar), this._nuke_schema_element(propvar, graph))
}

/**
 * Removes an element from the passed graph and all incoming and outgoing references to it -
 * (for schema graph - in data graphs we can just use delete_object(id))
 */
WOQLSchema.prototype._nuke_schema_element = function(elvar, graph) {
    elvar = elvar || 'v:SchemaElement'
    graph = graph || this.graph
    let outp = elvar + '_pout'
    let outv = elvar + '_vout'
    let inp = elvar + '_pin'
    let ins = elvar + '_sin'
    let ap = new WOQLQuery()
    return ap.and(
        new WOQLQuery()
            .opt()
            .and(
                new WOQLQuery().quad(elvar, outp, outv, graph),
                new WOQLQuery().delete_quad(elvar, outp, outv, graph),
            ),
        new WOQLQuery()
            .opt()
            .and(
                new WOQLQuery().quad(ins, inp, elvar, graph),
                new WOQLQuery().opt().delete_quad(ins, inp, elvar, graph),
            ),
    )
}

module.exports = WOQLSchema