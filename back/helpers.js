/**
 * Author: Nikolay Pilipovic
 * Email: nikola.pilipovic@gmail.com
 * Created on 18.04.2017.
 */

/**
 * Create property on object if it does not exists
 * @param obj
 * @param property_name
 */
var createObjectProperty = function(obj, property_name)
{
    if (!obj.hasOwnProperty(property_name)) {
        obj[property_name] = {};
    }
};

module.exports.createObjectProperty = createObjectProperty;