## GetSMS
<p align="center">
<a href="https://www.npmjs.com/package/getsms"><img src="https://img.shields.io/npm/v/getsms.svg?style=flat-square" alt="NPM version"></a>
<a href="https://www.npmjs.com/package/getsms"><img src="https://img.shields.io/npm/dt/getsms.svg?style=flat-square" alt="NPM downloads"></a>
<a href="https://www.codacy.com/gh/Viiprogrammer/getSMS/dashboard?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=Viiprogrammer/getSMS&amp;utm_campaign=Badge_Grade"><img src="https://app.codacy.com/project/badge/Grade/beb8f62dd6db47fb8f2dab52afc0e907"/></a>
</p>

[![NPM](https://nodei.co/npm/getsms.png?downloads=true&stars=true)](https://nodei.co/npm/getsms/)

getSMS - This is [Node.js](https://nodejs.org) module that allows you to interact with the SMS services api

## Features
-   Promises
-   Supports `SMSActivate`, `SMSHub`
-   Using [undici](https://github.com/nodejs/undici) http client

## Docs

You can find documentation [here](https://viiprogrammer.github.io/getSMS/)

## Installation
> **[Node.js](https://nodejs.org/) 12.0.0 or newer is required**  

### Yarn
```bash
yarn add getsms
```

### NPM
```bash
npm i getsms
```
## Errors caught

Errors that can be caught with `catch()`:
-   `BAD_KEY` -  Invalid api key
-   `ERROR_SQL` - Server database error
-   `BAD_ACTION` - Bad request data
-   `WRONG_SERVICE` - Wrong service identifier
-   `BAD_SERVICE` - Wrong service name',
-   `NO_ACTIVATION` - Activation not found.
-   `NO_BALANCE` - No balance
-   `NO_NUMBERS` - No numbers
-   `WRONG_ACTIVATION_ID` - Wrong activation id
-   `WRONG_EXCEPTION_PHONE` - Wrong exception phone
-   `NO_BALANCE_FORWARD` - No balance for forward
-   `NOT_AVAILABLE` - Multiservice is not available for selected country
-   `BAD_FORWARD` - Incorrect forward
-   `WRONG_ADDITIONAL_SERVICE` - Wrong additional service
-   `WRONG_SECURITY` - WRONG_SECURITY error
-   `REPEAT_ADDITIONAL_SERVICE` - Repeat additional service error
-   `BANNED:YYYY-m-d H-i-s` - Account banned

***if the ban code is `BANNED:YYYY-m-d H-i-s` then the error object contains the properties `banTime`, `banDate`, `banTimestamp`***
-   `banTime` - `YYYY-m-d H-i-s` (for example `2020-12-31 23-59-59`)
-   `banTimestamp` - Unixtime
-   `banDate` - JavaScript `new Date()` Object
## Usage example

```javascript
const { GetSMS, ServiceApiError, errors } = require('getsms')

const sms = new GetSMS({
  key: 'bc103fa02b63f986cd102a6d2f5c',
  url: 'https://smshub.org/stubs/handler_api.php',
  service: 'smshub'
});

(async () => {
  try {
    // eslint-disable-next-line camelcase
    const { balance_number } = await sms.getBalance()
    // eslint-disable-next-line camelcase
    if (balance_number > 0) {
      // Service - bd, operator - mts, country - russia (0)
      const { id, number } = await sms.getNumber('bd', 'mts', 0)
      console.log('Number ID:', id)
      console.log('Number:', number)

      // Set "message has been sent" status
      await sms.setStatus(1, id)

      // Wait for code
      const { code } = await sms.getCode(id)
      console.log('Code:', code)

      await sms.setStatus(6, id) // Accept, end
    } else console.log('No money')
  } catch (error) {
    if (error instanceof ServiceApiError) {
      if (error.code === errors.BANNED) {
        console.log(`Banned! Time ${error.banTime}`)
      } else {
        console.error(error.code, error.message)
      }
    } else console.error(error)
  }
})()
```
