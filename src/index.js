const { request } = require('undici')

const errorsList = {
  BANNED: 'Account banned',
  MAIL_RULE: 'For buying this service number you must satisfied additional site rules',
  NO_KEY: 'Key is empty',
  BAD_KEY: 'Invalid api key',
  ERROR_SQL: 'Server database error',
  BAD_ACTION: 'Bad request data',
  WRONG_SERVICE: 'Wrong service identifier',
  BAD_SERVICE: 'Wrong service name',
  NO_ACTIVATION: 'Activation not found.',
  NO_BALANCE: 'No balance',
  NO_NUMBERS: 'No numbers',
  WRONG_ACTIVATION_ID: 'Wrong activation id',
  WRONG_EXCEPTION_PHONE: 'Wrong exception phone',
  NO_BALANCE_FORWARD: 'No balance for forward',
  NOT_AVAILABLE: 'Multiservice is not available for selected country',
  BAD_FORWARD: 'Incorrect forward',
  WRONG_ADDITIONAL_SERVICE: 'Wrong additional service',
  WRONG_SECURITY: 'WRONG_SECURITY error',
  REPEAT_ADDITIONAL_SERVICE: 'Repeat additional service error'
}

const supportedMethods = {
  smshub: [
    'getNumbersStatus', 'getBalance', 'getNumber', 'setStatus', 'getStatus', 'getPrices', 'getCode',
    'setMaxPrice', 'getCurrentActivations', 'getListOfCountriesAndOperators'
  ],
  smsactivate: [
    'getNumbersStatus', 'getBalance', 'getNumber', 'setStatus', 'getStatus', 'getPrices', 'getFullSms',
    'getAdditionalService', 'getCountries', 'getQiwiRequisites', 'getCode'
  ]
}

class TimeoutError extends Error {
  /**
   * TimeoutError class constructor
   * @constructor
   * @param {string} message
   */
  constructor (message) {
    super()
    this.message = message
    this.name = this.constructor.name
  }
}

class ServiceApiError extends Error {
  /**
   * ServiceApiError class constructor
   * @constructor
   * @param {string} code Sms service error string
   */
  constructor (code) {
    super()
    this.message = errorsList[code]

    if (code.indexOf('BANNED:') === 0) {
      this.serverResponse = code
      this.code = 'BANNED'
      const datetime = code.split(':').pop()

      let [date, time] = datetime.split(/\s/)
      time = time.split('-').join(':')
      date = date.split('-').join('/')

      const obj = new Date(`${date} ${time}`)

      this.banTime = datetime
      this.banTimestamp = obj.getTime() / 1000
      this.banDate = obj
    } else {
      this.code = code
    }

    this.name = this.constructor.name
  }

  /**
   * Method for checking response includes an error from errors list
   * @method
   * @static
   * @private
   *
   * @param {string} response Http request response string
   * @return {boolean}
   */
  static _check (response) {
    return Object.keys(errorsList).includes(response) && (response.indexOf('BANNED:') !== 0)
  }
}

class GetSMS {
  /**
   * @typedef {object} InitProperties
   * @property {string} key Service API key
   * @property {string} url Service endpoint url
   * @property {string} [secondUrl=https://smshub.org/api.php] Used for method `getListOfCountriesAndOperators` (only SMSHUB)
   * @property {'en'|'ru'} [lang=ru] Lang code, smshub can return results with russian  or english (Only smshub)
   * @property {'smshub'|'smsactivate'} service Service name
   * @property {number} [interval=2000] Polling interval of getCode method
   */

  /**
   * GetSMS class constructor
   * @constructor
   *
   * @param {InitProperties} options Options object
   * @throws {Error}
   * @returns {GetSMS}
   */
  constructor ({ key, url, secondUrl = 'https://smshub.org/api.php', service, lang = 'ru', interval = 2000 }) {
    if (!key || !url || !service) {
      throw new Error('Missing argument(s)')
    }

    if (!['smshub', 'smsactivate'].includes(service)) {
      throw new Error('Invalid service name')
    }

    this._key = key
    this._url = url
    this._lang = lang
    this._secondUrl = secondUrl
    this._service = service
    this._interval = interval

    return new Proxy(this, {
      get (target, prop) {
        if (typeof target[prop] !== 'function') {
          return target[prop]
        }

        return function (...args) {
          if (!prop.startsWith('_') && !supportedMethods[target._service].includes(prop)) {
            throw new Error(`Method "${prop}" not supported by ${target._service}`)
          }

          return target[prop].apply(this, args)
        }
      }
    })
  }

  /**
   * Method for sending API requests
   * @method
   * @private
   *
   * @param {object} qs Query string params
   * @param {string} method Request METHOD
   * @param {object} [form] Form object
   * @param {boolean} [second=false] Use second API endpoint
   * @throws {Error|ServiceApiError}
   * @returns {Promise<object|string>}
   */
  async _request (qs, { method = 'GET', form, second = false } = {}) {
    const url = new URL(second ? this._secondUrl : this._url)

    url.search = new URLSearchParams(
      Object.assign(qs, { api_key: this._key })
    ).toString()

    return request(url, {
      method,
      form: form ? new URLSearchParams(form).toString() : undefined,
      headers: {
        Cookie: 'lang=' + this._lang
      }
    })
      .then(data => data.body.text())
      .then(data => {
        // Safe json parsing
        try {
          data = JSON.parse(data)
          return data
        } catch (e) {
          if (!ServiceApiError._check(data)) {
            return data
          } else {
            throw new ServiceApiError(data)
          }
        }
      })
  }

  /**
   * Method for getting number status
   * @method
   * @public
   *
   * @param {string|number} [country] Country ID
   * @param {string} [operator] Mobile operator code name
   * @throws {Error|ServiceApiError}
   * @returns {object}
   */
  async getNumbersStatus (country, operator) {
    return this._request({ action: 'getNumbersStatus', country, operator })
  }

  /**
   * @typedef {object} BalanceObject
   * @property {string} balance_string Balance as string
   * @property {number} balance_float Balance as float number
   * @property {number} balance_number Balance as multiplied by 100 as integer number
   */

  /**
   * Method for getting account balance
   * @method
   * @public
   *
   * @throws {Error|ServiceApiError}
   * @returns {Promise<BalanceObject>}
   */
  async getBalance () {
    const response = await this._request({ action: 'getBalance' })

    const [, balance] = response.split(':')
    const balanceParsed = parseFloat(balance)

    return {
      balance_string: balance,
      balance_float: balanceParsed,
      balance_number: balanceParsed * 100
    }
  }

  /**
   * Method for getting number for using with several services (only for smsactivate)
   * @method
   * @public
   *
   * @example
   * .getMultiServiceNumber('ok,vk,vi,av', 'mts', 0, '0,1,0,0')
   *
   * @example
   * .getMultiServiceNumber(['ok','vk','vi','av'], 'mts', 0, [0, 1, 0, 0])
   *
   * @param {array|string} service Array of services names
   * @param {array|string} operator Array of operators names
   * @param {string|number} country Country ID
   * @param {Array<string|number>|string} [forward] Number forward, must have values 1 or 0 *
   * @param {string} [ref] Referral identifier
   * @throws {Error|ServiceApiError}
   * @returns {Promise<object>}
   */
  async getMultiServiceNumber (service, operator, country, forward, ref) {
    if (Array.isArray(service)) service = service.toString()
    if (Array.isArray(forward)) forward = forward.toString()
    if (Array.isArray(operator)) operator = operator.toString()
    return this._request({ action: 'getPrices', service, operator, country, forward, ref })
  }

  /**
   * @typedef {object} additionalServiceResponse
   * @property {string} id Status code
   * @property {string} number Text from SMS
   */

  /**
   * Method for getting additional service for numbers with forward (only for smsactivate)
   * @method
   * @public
   *
   * @param {string} id Mobile number ID
   * @param {string} service Service code name
   * @returns {Promise<additionalServiceResponse>}
   * @throws {Error|ServiceApiError}
   */
  async getAdditionalService (id, service) {
    const response = await this._request({ action: 'getAdditionalService', id, service })

    const [, _id, number] = response.split(':')

    return {
      id: _id,
      number
    }
  }

  /**
   * @typedef {object} fullSMSTextResponse
   * @property {string} status Status code
   * @property {string} [text] Text from SMS. Is returning _**only if status is not `STATUS_WAIT_CODE`, `STATUS_CANCEL`**_
   */

  /**
   * Method for getting full sms text (only for smsactivate)
   * @method
   * @public
   *
   * @param {string|number} id Mobile number ID
   * @returns {Promise<fullSMSTextResponse>}
   * @throws {Error|ServiceApiError}
   */
  async getFullSms (id) {
    const response = await this._request({ action: 'getFullSms', id })

    const [status, text] = response.split(':')
    const res = { status }

    if (['STATUS_WAIT_CODE', 'STATUS_CANCEL'].includes(status)) {
      return res
    }

    if (status === 'FULL_SMS') {
      res.text = text
      return res
    }
  }

  /**
   * Method for getting countries list (only for smsactivate)
   * @method
   * @public
   *
   * @throws {Error|ServiceApiError}
   * @returns {Promise<object>}
   */
  async getCountries () {
    return this._request({ action: 'getCountries' })
  }

  /**
   * Method for getting Qiwi payment requisites (only for smsactivate)
   * @method
   * @public
   *
   * @throws {Error|ServiceApiError}
   * @returns {Promise<object>}
   */
  async getQiwiRequisites () {
    return this._request({ action: 'getQiwiRequisites' })
  }

  /**
   * Unofficial / hidden method for getting list of countries & operators (only for smshub)
   *
   * @method
   * @public
   *
   * @example Answer example:
   * {
   *     status: "success",
   *     services: [{
   *         lb: "Mailru Group",
   *         vk: "Вконтакте",
   *         ok: "Ok.ru",
   *         // ...
   *         ot: "Любой другой"
   *      },
   *      // ...
   *     ],
   *     data: [{
   *         name: "Индонезия",
   *         id: "6",
   *         operators: ["any", "axis", "indosat", "smartfren", "telkomsel", "three"]
   *     }],
   *     currentCountry: "0",
   *     currentOperator: "any"
   * }
   *
   * @throws {Error|ServiceApiError}
   * @returns {Promise<object>}
   */
  async getListOfCountriesAndOperators () {
    return this._request({
      cat: 'scripts',
      act: 'manageActivations',
      asc: 'getListOfCountriesAndOperators'
    }, {
      method: 'POST',
      second: true
    })
  }

  /**
   * Unofficial / hidden method for changing default number settings (only for smshub)
   * Change max price of mobile number for country id, enable / disable random
   * <br><br><div style="color: yellow">WARNING: I don't know why, but really values changed only  after ~30 seconds, maybe it's cached on smshub server</div>
   *
   * @method
   * @public
   *
   * @param {string} service Service code name
   * @param {string|number} maxPrice Max buy price
   * @param {boolean} random Enable random number
   * @param {string|number} country Country ID
   * @throws {Error|ServiceApiError}
   * @returns {Promise}
   */
  async setMaxPrice (service, maxPrice, random = true, country) {
    return this._request({ action: 'setMaxPrice', service, maxPrice, country, random })
  }

  /**
   * Unofficial / hidden method for getting list of current activations (only for smshub)
   *
   * @method
   * @public
   *
   * @example Answer example:
   * // Success request:
   *
   * {
   *   status: 'success',
   *   array: [
   *     {
   *       id: '1231231231',
   *       activationId: '1231231231',
   *       apiKeyId: '12345',
   *       phone: '79538364598',
   *       status: '2',
   *       moreCodes: '',
   *       createDate: 1654770955,
   *       receiveSmsDate: -62169993017,
   *       finishDate: '0000-00-00 00:00:00',
   *       activation: [Object],
   *       code: '<img src="/assets/ico/loading.gif" width="50px"></img>',
   *       countryCode: '7',
   *       countryName: 'Россия',
   *       timer: 1200
   *     }
   *   ],
   *   time: 1654770985
   * }
   *
   * // No activations:
   * { status: 'fail', msg: 'no_activations' }
   *
   * @throws {Error|ServiceApiError}
   * @returns {Promise<object>}
   */
  async getCurrentActivations () {
    return this._request({ action: 'getCurrentActivations' })
  }

  /**
   * @typedef {object} getCodeResponse
   * @property {string} status Status code
   * @property {string|undefined} code Code from SMS
   */

  /**
   * Method for getting new number
   * Arguments with * available only for smsactivate
   *
   * @method
   * @public
   *
   * @param {string} service Service code name
   * @param {string} [operator] Mobile operator code name
   * @param {string|number} [country] Country ID
   * @param {string|number} [forward] Number forward, must be `1` or `0` *
   * @param {string} [phoneException] Prefixes for excepting mobile numbers separated by comma *
   * @param {string} [ref] Referral identifier *
   *
   * @throws {Error|ServiceApiError}
   * @returns {Promise<object>}
   */
  async getNumber (service, operator, country, forward, phoneException, ref) {
    const response = await this._request({ action: 'getNumber', service, operator, country, forward, phoneException, ref })

    const [, id, number] = response.split(':')

    return {
      id,
      number
    }
  }

  /**
   * Method for set number status
   * @method
   * @public
   *
   * @param {string|number} status New mobile number status
   * @param {string|number} id Mobile number ID
   *
   * @throws {Error|ServiceApiError}
   * @returns {Promise<object>}
   */
  async setStatus (status, id) {
    const response = await this._request({ action: 'setStatus', status, id })

    return { status: response }
  }

  /**
   * @typedef {object} getCodeResponse
   * @property {string} status Status code
   * @property {string|undefined} code Code from SMS. Is returning _**only with `STATUS_WAIT_RETRY`, `STATUS_OK` statuses**_
   */

  /**
   * Method which polling with getStatus method and returns new status when it's changes
   *
   * @method
   * @public
   *
   * @example
   * const { id, number } = await sms.getNumber('vk', 'mts', 0)
   * console.log('Number ID:', id);
   * console.log('Number:', number);
   * await sms.setStatus(1, id);
   * // Wait for code
   * const { code } = await sms.getCode(id)
   * console.log('Code:', code)
   * await sms.setStatus(1, id) //Accept, end
   *
   * @param {string|number} id - Mobile number ID
   * @param {number} [timeout=0] - Timeout, after reached - forcefully stop and throw `TimeoutError`, pass 0 to disable
   * @throws {Error|ServiceApiError|TimeoutError}
   * @returns {Promise<getCodeResponse>}
   */
  async getCode (id, timeout = 0) {
    return new Promise((resolve, reject) => {
      let timeoutId = null

      const interval = setInterval(async () => {
        try {
          const {
            status,
            code
          } = await this.getStatus(id)

          // eslint-disable-next-line no-empty
          if (status === 'STATUS_WAIT_CODE') {}

          if (status === 'STATUS_CANCEL') {
            clearInterval(interval)
            if (timeoutId) clearTimeout(timeoutId)
            resolve({ status })
          }

          if (status === 'STATUS_OK') {
            clearInterval(interval)
            if (timeoutId) clearTimeout(timeoutId)
            resolve({ code })
          }
        } catch (err) {
          clearInterval(interval)
          if (timeoutId) clearTimeout(timeoutId)
          reject(err)
        }
      }, this._interval)

      if (timeout) {
        timeoutId = setTimeout(() => {
          clearInterval(interval)
          clearTimeout(timeoutId)

          reject(new TimeoutError(`Timeout ${timeout}ms reached`))
        }, timeout)
      }
    })
  }

  /**
   * Method for getting number status
   * @method
   * @public
   * @param {string|number} id Mobile number ID
   * @throws {Error|ServiceApiError}
   * @returns {Promise<object>}
   */
  async getStatus (id) {
    const response = await this._request({ action: 'getStatus', id })

    if (['STATUS_CANCEL', 'STATUS_WAIT_RESEND', 'STATUS_WAIT_CODE'].includes(response)) {
      return { status: response }
    }

    const [type, code] = response.split(':')

    if (type === 'STATUS_WAIT_RETRY') {
      return { status: type, code }
    }

    if (type === 'STATUS_OK') {
      return { status: type, code }
    }

    return { status: 'UNKNOWN' }
  }

  /**
   * Method for getting numbers prices
   * @method
   * @public
   * @param {string|number} [country] Country ID
   * @param {string} service Service code name
   * @throws {Error|ServiceApiError}
   * @returns {Promise<object>}
   */
  async getPrices (service, country) {
    return this._request({ action: 'getPrices', country, service })
  }
}

module.exports = {
  GetSMS,
  ServiceApiError,
  TimeoutError,
  errors: Object.fromEntries(
    Object.keys(errorsList)
      .map(e => [e, e])
  )
}
