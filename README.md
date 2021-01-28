## Description
<p align="center">
<a href="https://www.npmjs.com/package/getsms"><img src="https://img.shields.io/npm/v/getsms.svg?style=flat-square" alt="NPM version"></a>
<a href="https://www.npmjs.com/package/getsms"><img src="https://img.shields.io/npm/dt/getsms.svg?style=flat-square" alt="NPM downloads"></a>
</p>

[![NPM](https://nodei.co/npm/getsms.png?downloads=true&stars=true)](https://nodei.co/npm/getsms/)

getSMS - This is [Node.js](https://nodejs.org) module that allows you to interact with the SMS services api

## Features
- Promises
- Suppurt `SMSActivate`, `SMSHub`

## Installation
> **[Node.js](https://nodejs.org/) 12.0.0 or newer is required**  

### Yarn
```
yarn add getsms
```

### NPM
```
npm i getsms
```
## Errors caught

Errors that can be caught with `catch()`:

- `BAD_KEY` -  Invalid api key
- `ERROR_SQL` - Server database error
- `BAD_ACTION` - Bad request data
- `WRONG_SERVICE` - Wrong service identifier
- `BAD_SERVICE` - Wrong service name',
- `NO_ACTIVATION` - Activation not found.
- `NO_BALANCE` - No balance
- `NO_NUMBERS` - No numbers
- `WRONG_ACTIVATION_ID` - Wrong activation id
- `WRONG_EXCEPTION_PHONE` - Wrong exception phone
- `NO_BALANCE_FORWARD` - No balance for forward
- `NOT_AVAILABLE` - Multiservice is not available for selected country
- `BAD_FORWARD` - Incorrect forward
- `WRONG_ADDITIONAL_SERVICE` - Wrong additional service
- `WRONG_SECURITY` - WRONG_SECURITY error
- `REPEAT_ADDITIONAL_SERVICE` - Repeat additional service error
- `BANNED:YYYY-m-d H-i-s` - Account banned

***if the ban code is `BANNED:YYYY-m-d H-i-s` then the error object contains the properties `banTime`, `banDate`, `banTimestamp`***
* `banTime` - `YYYY-m-d H-i-s` (for example `2020-12-31 23-59-59`)
* `banTimestamp` - Unixtime
* `banDate` - JavaScript `new Date()` Object
## Usage example:
```javascript
const {getSMS, ServiceApiError} = require('getsms');
const sms = new getSMS({
    key: 'bc103fa02b63f986cd102a6d2f5c',
    url: 'https://sms-activate.ru/stubs/handler_api.php',
    service: 'smsactivate'
});
(async() => {
    sms.getBalance().then(async(balance) => {
            if(balance.balance_number > 0){
               //Service - vk, operator - mts, country - russia (0)
               await sms.getNumber('vk', 'mts', 0)
               .then(async({id, number}) => {
                     console.log('Number ID:', id);
                     console.log('Number:', number);
                     //Set "message has been sent" status
                     await sms.setStatus(1, id);
                     //Wait for code
                     await sms.getCode(id).then(async({id, code}) => {
                        console.log('Code:', code);
                        await sms.setStatus(1, id); //Accept, end
                     });
                }) 
               .catch((error) => {
                   if(error instanceof ServiceApiError){
                        if(error.code === 'BANNED'){
                            console.log(`Banned! Time ${error.banTime}`);
                        } else {
                            console.error(error.code, error.message);
                        }
                   }  else console.error(error)        
               });         
            } else console.log('No money');   
    }).catch((error) => {
        if(error instanceof ServiceApiError){
            console.error(error.code, error.message);
        }  else console.error(error)        
    })
})();
```

## Methods

#### Constructor:

Syntax:

```javascript
new getSMS({key: String, url: String, service: String [,interval: Number]})
```

`Object:`
* `key`* - API key
* `url`* - Service api handler url (For example - `https://sms-activate.ru/stubs/handler_api.php`)
* `service`* - may contain the following values:
    * `smshub`
    * `smsactivate`
* `interval` - by default **2000 ms**. This is value for `getCode` polling interval

**\* - Required fields**

Example:
```javascript
const {getSMS: sms, ServiceApiError} = new getSMS({
    key: 'bc103fa02b63f986cd102a6d2f5cf',
    url: 'https://sms-activate.ru/stubs/handler_api.php',
    service: 'smsactivate'
})
```
---

#### .getNumbersStatus()

Syntax:

```javascript
sms.getNumbersStatus(country, operator)
```

Returns: `Object`

---

#### .getBalance()

Syntax:

```javascript
sms.getBalance()
```

Returns:
`Object`:
* `balance_string` - `String`
* `balance_float` - `Number`
* `balance_number` - `Number`

---

#### .getMultiServiceNumber()
Syntax:

```javascript
sms.getMultiServiceNumber(multiService: Array, operator: String, country: Number, multiForward: Array, ref: String)
```

Returns: `Object`

Example: 

```javascript
sms.getMultiServiceNumber(multiService: ['vk', 'ab'], operator: 'mts', country: 0, multiForward: [1, 0], ref: String)
```


---

#### .getAdditionalService()

Syntax:

```javascript
sms.getAdditionalService(id: Number, service: String)
```

Returns:
`Object`:
* `id`
* `Number`

---

#### .getFullSms()

Syntax:

```javascript
sms.getAdditionalService(id: Number)
```

Returns:
`Object`:
* `status` - number status
* `text` - Is returning **only if status is not `STATUS_WAIT_CODE`, `STATUS_CANCEL`**

---

#### .getCountries()
Syntax:

```javascript
sms.getCountries()
```

Returns: `Object`

---

#### .getQiwiRequisites()
Syntax:

```javascript
sms.getQiwiRequisites()
```

Returns: `Object`

---

#### .getNumber()
Syntax:

```javascript
sms.getNumber(service: String, operator: String, country: String, forward: String, phoneException: String, ref: String)
```


Returns:
`Object`:
* `id` - Number id
* `number` - Phone number

---

#### .setStatus()
Syntax:

```javascript
sms.setStatus(status: Number, id: Number)
```


Returns:
`Object`:
* `status` - Status from service

---

#### .getCode()
Syntax:

```javascript
sms.getCode(id: Number)
```

Returns:
`Object`:
* `status` - number status (`STATUS_CANCEL`, `STATUS_WAIT_RETRY`, `STATUS_OK`)
* `code` - Is returning only with `STATUS_WAIT_RETRY`, `STATUS_OK` statuses

---

#### .getPrices()
Syntax:

```javascript
sms.getPrices()
```

Returns: `Object`
