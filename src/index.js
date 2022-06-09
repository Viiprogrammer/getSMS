const { request } = require('undici')

const errorsList = {
  BANNED: 'Account banned',
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

class ServiceApiError extends Error {
  /**
   * ServiceApiError class constructor
   * @constructor
   * @param code Sms service error string
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
   * @return boolean
   * @param response Http request response string
   */
  static _check (response) {
    return Object.keys(errorsList).includes(response) && (response.indexOf('BANNED:') !== 0)
  }
}

class GetSMS {
  /**
   * Enum for tri-state values.
   * @enum {number}
   */

  /**
   * @typedef InitProperties
   * @type {object}
   * @property {string} key - Service API key
   * @property {string} url - Service endpoint url
   * @property {string} [secondUrl=https://smshub.org/api.php] - Used for method <code>getListOfCountriesAndOperators</code> (only SMSHUB)
   * @property {(en|ru)} [lang=ru] - Lang code, smshub can returns results with russian  or english (Only smshub)
   * @property {(smshub|smsactivate)} service - Service name
   * @property {interval} [interval=2000] - Polling interval of getCode method
   */

  /**
   * GetSMS class constructor
   * @constructor
   * @returns GetSMS
   * @param {InitProperties} - Options object
   * @throws Error
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
   * @async
   * @returns {Promise<object|string>}
   * @param {object} qs - Query string params
   * @param {string} method - Request METHOD
   * @param {object|undefined} form - Form object
   * @param {boolean} [second=false] - Use second API endpoint
   * @throws Error
   * @throws ServiceApiError
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
   * @async
   * @returns {object}
   * @param {string|number} country - Country ID
   * @param {string} operator - Mobile operator code name
   * @throws Error
   * @throws ServiceApiError
   */
  getNumbersStatus (country, operator) {
    return this._request({ action: 'getNumbersStatus', country, operator })
  }

  /**
   * @typedef BalanceObject
   * @type {object}
   * @property {string} balance_string - Balance as string
   * @property {number} balance_float - Balance as float number
   * @property {number} balance_number - Balance as multiplied by 100 as integer number
   */

  /**
   * Method for getting account balance
   * @method
   * @public
   * @async
   * @returns {Promise<BalanceObject>}
   * @throws Error
   * @throws ServiceApiError
   */
  getBalance () {
    return this._request({ action: 'getBalance' })
      .then((response) => {
        const [, balance] = response.split(':')
        const balanceParsed = parseFloat(balance)
        return {
          balance_string: balance,
          balance_float: balanceParsed,
          balance_number: balanceParsed * 100
        }
      })
  }

  /**
   * Method for getting number for using with several services (only for smsactivate)
   * @method
   * @public
   * @async
   * @param {array|string} service - Array of services names
   * @param {array|string} operator - Array of operators names
   * @param {string|number} country - Country ID
   * @param {(Array<(string|number)>|(number|string))} forward - Number forward, must have values 1 or 0 *
   * @param ref - Referral identifier
   * @returns {Promise<Object>}
   * @throws Error
   * @throws ServiceApiError
   * @example
   * .getMultiServiceNumber('ok,vk,vi,av', 'mts', 0, '0,1,0,0')
   * @example
   * .getMultiServiceNumber(['ok','vk','vi','av'], 'mts', 0, [0, 1, 0, 0])
   */
  getMultiServiceNumber (service, operator, country, forward, ref) {
    if (Array.isArray(service)) service = service.toString()
    if (Array.isArray(forward)) forward = forward.toString()
    if (Array.isArray(operator)) operator = operator.toString()
    return this._request({ action: 'getPrices', service, operator, country, forward, ref })
  }

  /**
   * @typedef additionalServiceResponse
   * @type {object}
   * @property {string} id - Status code
   * @property {string} number - Text from SMS
   */

  /**
   * Method for getting additional service for numbers with forward (only for smsactivate)
   * @method
   * @public
   * @async
   * @param {string} id - Mobile number ID
   * @param {string} service - Service code name
   * @returns {Promise<additionalServiceResponse>}
   * @throws Error
   * @throws ServiceApiError
   */
  getAdditionalService (id, service) {
    return this._request({ action: 'getAdditionalService', id, service })
      .then((response) => {
        const [, id, number] = response.split(':')
        return {
          id,
          number
        }
      })
  }

  /**
   * @typedef fullSMSTextResponse
   * @type {object}
   * @property {string} status - Status code
   * @property {string|undefined} text - Text from SMS. Is returning <i><b>only if status is not <code>STATUS_WAIT_CODE</code>, <code>STATUS_CANCEL</code></b></i>
   */

  /**
   * Method for getting full sms text (only for smsactivate)
   * @method
   * @public
   * @async
   * @param {string|number} id - Mobile number ID
   * @returns {Promise<fullSMSTextResponse>}
   * @throws Error
   * @throws ServiceApiError
   */
  getFullSms (id) {
    return this._request({ action: 'getFullSms', id })
      .then((response) => {
        const [status, text] = response.split(':')
        const res = { status }
        if (['STATUS_WAIT_CODE', 'STATUS_CANCEL'].includes(status)) {
          return res
        } else if (status === 'FULL_SMS') {
          res.text = text
          return res
        }
      })
  }

  /**
   * Method for getting countries list (only for smsactivate)
   * @method
   * @public
   * @async
   * @returns {Promise<Object>}
   * @throws Error
   * @throws ServiceApiError
   */
  getCountries () {
    return this._request({ action: 'getCountries' })
  }

  /**
   * Method for getting Qiwi payment requisites (only for smsactivate)
   * @method
   * @public
   * @async
   * @returns {Promise<Object>}
   * @throws Error
   * @throws ServiceApiError
   */
  getQiwiRequisites () {
    return this._request({ action: 'getQiwiRequisites' })
  }

  /**
   * Unofficial / hidden method for getting list of countries & operators (only for smshub)
   * @method
   * @public
   * @async
   * @returns {Promise<Object>}
   * @throws Error
   * @throws ServiceApiError
   * @example <caption>Answer example:</caption>
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
   */
  getListOfCountriesAndOperators () {
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
   * Change max price of mobile number for coutry id, enable / disable random
   * <br><br><div style="color: yellow">WARNING: I don't know why, but really values changed only  after ~30 seconds, maybe it's cached on smshub server</div>
   * @method
   * @public
   * @async
   * @param {string} service - Service code name
   * @param {string|number} maxPrice - Max buy price
   * @param {boolean} random - Enable random number
   * @param {string|number} country - Country ID
   * @returns {Promise}
   * @throws Error
   * @throws ServiceApiError
   */
  setMaxPrice (service, maxPrice, random = true, country) {
    return this._request({ action: 'setMaxPrice', service, maxPrice, country, random })
  }

  /**
   * Unofficial / hidden method for getting list of current activations (only for smshub)
   * @method
   * @public
   * @async
   * @returns {Promise<Object>}
   * @throws Error
   * @throws ServiceApiError
   * @example <caption>Answer example:</caption>
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
   */
  getCurrentActivations () {
    return this._request({ action: 'getCurrentActivations' })
  }

  /**
   * @typedef getCodeResponse
   * @type {object}
   * @property {string} status - Status code
   * @property {string|undefined} code - Code from SMS
   */

  /**
   * Method for getting new number
   * Arguments with * available only for smsactivate
   * @method
   * @public
   * @async
   * @param {string} service - Service code name
   * @param {string} operator - Mobile operator code name
   * @param {string|number} country - Country ID
   * @param {(string|number)} forward - Number forward, must be <code>1</code> or <code>0</code> *
   * @param {string} phoneException - Prefixes for excepting mobile numbers separated by comma *
   * @param {string} ref - Referral identifier *
   * @returns {Promise<Object>}
   * @throws Error
   * @throws ServiceApiError
   */
  getNumber (service, operator, country, forward, phoneException, ref) {
    return this._request({ action: 'getNumber', service, operator, country, forward, phoneException, ref })
      .then((response) => {
        const [, id, number] = response.split(':')
        return {
          id,
          number
        }
      })
  }

  /**
   * Method for set number status
   * @method
   * @public
   * @async
   * @param {string|number} status - New mobile number status
   * @param {string|number} id - Mobile number ID
   * @returns {Promise<Object>}
   * @throws Error
   * @throws ServiceApiError
   */
  setStatus (status, id) {
    return this._request({ action: 'setStatus', status, id })
      .then(status => ({ status }))
  }

  /**
   * @typedef getCodeResponse
   * @type {object}
   * @property {string} status - Status code
   * @property {string|undefined} code - Code from SMS. Is returning <i><b>only with <code>STATUS_WAIT_RETRY</code>, <code>STATUS_OK</code> statuses</b></i>
   */

  /**
   * Method which polling with getStatus method and returns new status when it's changes
   * @method
   * @public
   * @async
   * @param {string|number} id - Mobile number ID
   * @returns {Promise<getCodeResponse>}
   * @throws Error
   * @throws ServiceApiError
   * @example
   * const { id, number } = await sms.getNumber('vk', 'mts', 0)
   * console.log('Number ID:', id);
   * console.log('Number:', number);
   * await sms.setStatus(1, id);
   * //Wait for code
   * const { code } = await sms.getCode(id).then(async() => {
   * console.log('Code:', code)
   * await sms.setStatus(1, id) //Accept, end
   */
  getCode (id) {
    return new Promise((resolve, reject) => {
      const interval = setInterval(() => {
        this.getStatus(id).then(({ status, code }) => {
          // eslint-disable-next-line no-empty
          if (status === 'STATUS_WAIT_CODE') {}

          if (status === 'STATUS_CANCEL') {
            clearInterval(interval)
            resolve({ status })
          }

          if (status === 'STATUS_OK') {
            clearInterval(interval)
            resolve({ code })
          }
        }).catch(err => reject(err))
      }, this._interval)
    })
  }

  /**
   * Method for getting number status
   * @method
   * @public
   * @async
   * @param {string|number} id - Mobile number ID
   * @returns {Promise<Object>}
   * @throws Error
   * @throws ServiceApiError
   */
  getStatus (id) {
    return this._request({ action: 'getStatus', id })
      .then((response) => {
        if (['STATUS_CANCEL', 'STATUS_WAIT_RESEND', 'STATUS_WAIT_CODE'].includes(response)) {
          return { status: response }
        } else {
          const [type, code] = response.split(':')
          if (type === 'STATUS_WAIT_RETRY') {
            return { status: type, code }
          }
          if (type === 'STATUS_OK') {
            return { status: type, code }
          }
          return { status: 'UNKNOWN' }
        }
      })
  }

  /**
   * Method for getting numbers prices
   * @method
   * @public
   * @async
   * @param {string|number} country - Country ID
   * @param {string} service - Service code name
   * @returns {Promise<Object>}
   * @throws Error
   * @throws ServiceApiError
   */
  getPrices (service, country) {
    return this._request({ action: 'getPrices', country, service })
  }
}

module.exports = {
  GetSMS,
  ServiceApiError,
  errors: Object.fromEntries(
    Object.keys(errorsList)
      .map(e => [e, e])
  )
}
