var Promise = require('bluebird');

var Validator = function (rules, data, models) {

	//TODO: do attributes case-insensitive?

	/******************************************/
	/************** properties ****************/

	this.data = {};
	this.rules = {};
	this.models = {};
	this.messages = {};
	this.failedRules = {};
	this.foundModels = {};

	this.sizeRules = ['Size', 'Between', 'Min', 'Max'];
	this.numericRules = ['Numeric', 'Integer'];
	this.implicitRules = ['Required', 'RequiredWith', 'RequiredWithAll', 'RequiredWithout', 'RequiredWithoutAll', 'RequiredIf', 'Accepted'];



	/***********************************************/
	/**************** constructor ******************/

	this.constructor = function(rules, data, models) {
		this.rules = this.explodeRules(rules);
		this.data = data || {};
		this.models = models || Validator.models;
	};


	this.explodeRules = function(rules) {
		var exploded = {};
		for (var attribute in rules)
			exploded[attribute] = rules[attribute].split('|').map(function(rule) {
				return this.parseRule(rule);
			}, this);
		return exploded;
	};

	this.parseRule = function(rule) {
		var name = rule;
		var parameters = [];
		if (rule.indexOf(':') >= 0) {
			var exploded = rule.split(':');
			name = exploded[0];
			parameters = this.parseParameters(exploded[1]);
		}
		name = this.capitalize(name);
		return {name: name, parameters: parameters};
	};

	this.parseParameters = function(parameters) {
		return parameters.split(',');
	};



	/**************************************************/
	/************** validation process ****************/

	this.validate = function(attribute, rule) {

		var validator = this;

		var promise = new Promise(function(resolve, reject) {

			if (rule.name == '') {
				resolve(true);
				return;
			}

			var validatable = validator.isValidatable(rule, attribute);
			var validateMethod = 'validate'+rule.name;

			if (validatable && validator[validateMethod]) {

				resolve(validator[validateMethod](attribute, rule.parameters));

			} else {

				resolve(true);

			}
		});

		promise
		.then(function(validated) {
			if (!validated)
				validator.addFailure(attribute, rule);
		})
		.catch(function(err){});

		return promise;
	};

	this.isValidatable = function(rule, attribute) {
		return this.presentOrRuleIsImplicit(attribute, rule);
			//&& this.passesOptionalCheck(attribute);
	};

	this.presentOrRuleIsImplicit = function(attribute, rule) {
		return this.validateRequired(attribute) || this.isImplicit(rule);
	};

	this.isImplicit = function(rule) {
		return this.in_array(rule.name, this.implicitRules);
	};

	this.addFailure = function(attribute, rule) {
		this.addError(attribute, rule);
		//this.failedRules[attribute][rule] = rule.parameters;
	};

	this.addError = function(attribute, rule) {
		var message = this.getMessage(attribute, rule);
		message = this.doReplacements(message, attribute, rule);
		if (!this.messages[attribute])
			this.messages[attribute] = [];
		this.messages[attribute].push(message);
	};

	this.getMessage = function(attribute, rule) {
		var message = 'Failed validation of attribute "'+attribute+'" for rule "'+rule.name+'".';
		return message;
	};

	this.addFoundModel = function(attribue, model) {
		if (this.foundModels[attribute] == undefined)
			this.foundModels[attribute] = [];
		this.foundModels[attribute].push(model);
	};



	/*******************************************************/
	/***************** validation rules ********************/

	this.validateRequired = function(attribute) {
		var value = this.data[attribute];
		if (typeof value === 'string')
			value = value.replace(/[\s\xa0]+/g, ' ').replace(/^\s+|\s+$/g, '');
		return !(value===undefined || value===null || value==='');
	};

	this.validateFilled = function(attribute) {
		if (this.data[attribute] !== undefined)
			return this.validateRequired(attribute);
		return true;
	};

	this.anyFailingRequired = function(attributes) {
		for (i in attributes)
			if (! this.validateRequired(attributes[i]))
				return true;
		return false;
	};

	this.allFailingRequired = function(attributes) {
		for (i in attributes)
			if (this.validateRequired(attributes[i]))
				return false;
		return true;
	};

	this.validateRequiredWith = function(attribute, parameters) {
		if (! this.allFailingRequired(parameters))
			return this.validateRequired(attribute);
		return true;
	};

	this.validateRequiredWithAll = function(attribute, parameters) {
		if (! this.anyFailingRequired(parameters))
			return this.validateRequired(attribute);
		return true;
	};

	this.validateRequiredWithout = function(attribute, parameters) {
		if (this.anyFailingRequired(parameters))
			return this.validateRequired(attribute);
		return true;
	};

	this.validateRequiredWithoutAll = function(attribute, parameters) {
		if (this.allFailingRequired(parameters))
			return this.validateRequired(attribute);
		return true;
	};

	this.validateRequiredIf = function(attribute, parameters) {
		//this.requireParameterCount(2, parameters, 'required_if');
		if (parameters[1] == this.data[parameters[0]])
			return this.validateRequired(attribute);
		return true;
	};

	this.validateSame = function(attribute, parameters) {
		//this.requireParameterCount(1, parameters, 'same');
		return this.data[parameters[0]] === this.data[attribute];
	};

	this.validateDifferent = function(attribute, parameters) {
		//this.requireParameterCount(1, parameters, 'different');
		return this.data[parameters[0]] !== this.data[attribute];
	};

	this.validateAccepted = function(attribute) {
		var acceptable = ['yes', 'y', 'on', '1', 1, true, 'true'];
		return this.validateRequired(attribute) && this.in_array(this.data[attribute], acceptable);
	};

	this.validateArray = function(attribute) {
		return this.data[attribute] instanceof Array;
	};

	this.validateNumeric = function(attribute) {
		var value = this.data[attribute];
		return !this.validateArray(attribute) && (value - parseFloat(value) + 1) >= 0;
	};

	this.validateInteger = function(attribute) {
		var value = this.data[attribute];
		return this.validateNumeric(attribute) && parseInt(value) == value;
	};

	this.validateDigits = function(attribute, parameters) {
		//this.requireParameterCount(1, parameters, 'digits');
		return this.validateNumeric(attribute) && (''+this.data[attribute]).length == parameters[0];
	};

	this.validateDigitsBetween = function(attribute, parameters) {
		//this.requireParameterCount(2, parameters, 'digits_between');
		var value = ''+this.data['attribute'];
		return this.validateNumeric(attribute) && value.length >= parameters[0] && value.length <= parameters[1];
	};

	this.validateSize = function(attribute, parameters) {
		//this.requireParameterCount(1, parameters, 'size');
		return this.getSize(this.data[attribute]) == parameters[0];
	};

	this.validateBetween = function(attribute, parameters) {
		//this.requireParameterCount(2, parameters, 'between');
		var value = this.getSize(this.data[attribute]);
		return parameters[0] <= value && value <= parameters[1];
	};

	this.validateMin = function(attribute, parameters) {
		//this.requireParameterCount(1, parameters, 'min');
		return this.getSize(this.data[attribute]) >= parameters[0];
	};

	this.validateMax = function(attribute, parameters) {
		//this.requireParameterCount(1, parameters, 'max');
		return this.getSize(this.data[attribute]) <= parameters[0];
	};

	this.validateIn = function(attribute, parameters) {
		return this.in_array(this.data[attribute], parameters);
	};

	this.validateNotIn = function(attribute, parameters) {
		return !this.validateIn(attribute, parameters);
	};

	this.validateUnique = function(attribute, parameters) {

		var validator = this;

		var promise = new Promise(function(resolve, reject) {

			//validator.requireParameterCount(1, parameters, 'unique');

			if (parameters[1] === undefined)
				parameters[1] = attribute;

			var where = {};
			where[parameters[1]] = validator.data[attribute];

			if (validator.models[parameters[0]]) {

				validator.models[parameters[0]].find({where: where})
				.then(function(instance) {
					if (instance) {
						validator.addFoundModel(attribute, instance);
						resolve(false);
					}
					else {
						resolve(true);
					}
				})
				.catch(function(err) {
					reject(err);
				});

			} else {

				var err = 'Model "'+parameters[0]+'" not found';
				reject(err);

			}
		});

		return promise;
	};

	this.validateEmail = function(attribute) {
		var regex = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
		return regex.test(this.data[attribute]);
	};

	this.validateDate = function(attribute) {
		// yyyy-MM-dd(Thh:mm(:ss(,ss)))(Z|[+-]hhmm)
		// year:         1
		// month:        2
		// day:          3
		// hour:         5
		// minute:       6
		// second:       8
		// zone:        10
		// zone hour:   11
		// zone minute: 12
		var regex = /^(\d{4})-(\d{2})-(\d{2})(T(\d{2}):(\d{2})(:(\d{2})(,\d{2})?)?)?(Z|[+-](\d{2}):?(\d{2}))$/; //TODO: standarize?
		var matched = this.data[attribute].match(regex);
		if (!matched)
			return false;

		var year = parseInt(matched[1]);
		var month = parseInt(matched[2]);
		var day = parseInt(matched[3]);

		if (month > 12 || month < 1)
			return false;
		if (day < 1 || day > 31)
			return false;
		if (this.in_array(month, [4, 6, 9, 11]) && day > 30)
			return false;
		if (month == 2 && day > 28 + this.oneIfLeapYear(year))
			return false;

		var hour = parseInt(matched[5]);
		var minute = parseInt(matched[6]);

		if (hour && hour > 23)
			return false;
		if (minute && minute > 59)
			return false

		var zone = matched[10];

		if (zone && zone != 'Z') {
			var zoneHour = parseInt(matched[11]);
			var zoneMinute = parseInt(matched[12]);

			if (zoneHour && zoneHour > 12)
				return false;
			if (zoneMinute && zoneMinute > 59)
				return false;
			if (zoneHour && zoneHour == 12 && zoneMinute && zoneMinute != 0)
				return false;
		};

		return true;
	}


	/*************************************************/
	/**************** replacements *******************/

	this.doReplacements = function(message, attribute, rule) {
		return message; //TODO
	};



	/*******************************************/
	/****************** API ********************/

	this.setData = function(data) {
		this.data = data;
	};

	this.setRules = function(rules) {
		this.rules = this.explodeRules(rules);
	};

	this.setModels = function(models) {
		this.models = models;
	};

	this.check = function() {

		this.messages = {};
		this.foundModels = {};

		var validations = [];
		for (var attribute in this.rules)
			for (var i in this.rules[attribute])
				validations.push(this.validate(attribute, this.rules[attribute][i]));

		var promise = new Promise(function(resolve, reject) {

			Promise.all(validations)
			.then(function(results) {

				var valid = true;
				for (var i in results) {
					if (results[i] === false) {
						valid = false;
						break;
					}
					else if (results[i] === undefined) {
						reject('muerto');
						return;
					}
				}
				resolve(valid);

			})
			.catch(function(err) {
				reject(err);
			});
		});

		return promise;
	};

	this.errors = function() {
		return this.messages;
	};

	this.passes = function() {
		return this.messages.length == 0;
	};

	this.fails = function() {
		return !this.passes;
	};



	/*******************************************/
	/****************** aux ********************/

	this.capitalize = function(string) {
		return string.charAt(0).toUpperCase()+string.slice(1);
	};

	this.in_array = function(element, array) {
		return array.indexOf(element) >= 0;
	};

	this.oneIfLeapYear = function(year) {
		return year%4==0 && (year%100!=0 || year%400==0) ? 1 : 0;
	};

	this.getSize = function(value) {
		if (typeof value === 'number')
			return number;
		if (typeof value === 'string')
			return value.length;
		if (value instanceof Array)
			return value.length;
		else
			return (''+value).length;
	};



	/*****************************************************/
	/***************** initialize ************************/
	this.constructor(rules, data, models);
};




/***************************************************/
/***************** class methods *******************/

Validator.models = {}; // Do not use directly
Validator.setModels = function(models) {
	for (var model in Validator.models)
		delete Validator.models[model];
	for (var model in models)
		Validator.models[model] = models[model];
};




/******************************************/
/**************** exports *****************/

module.exports = Validator;

