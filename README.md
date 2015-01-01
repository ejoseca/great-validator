great-validator
===============

Asynchronus laravel-like validator for Node.js using Express

## Quick start

```
npm install great-validator
```

```javascript
var Validator = require('great-validator');

var rules = {
    email:    'email|required',
    password: 'required|min:8'
}

var data = {
    email:    'joseca@greatvalidator.com',
    password: 'josecasPassword'
}

var validator = new Validator(rules, data);
validator.check()
.next(function(isValid) {
    if (isValid) {
        console.log('OK');
    }
    else {
        console.log('Failed');
    }
})
.catch(function(err) {
    console.error(err);
});
```


## Release History

* 0.2.0 More validation rules
* 0.1.0 Initial release

