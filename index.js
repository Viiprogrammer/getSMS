const fetch = require('node-fetch');
const errorsList = {
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
class ServiceApiError extends Error {
    constructor(code) {
        super();
        this.message = errorsList[code];

        if(code.indexOf('BANNED:') === 0){
            this.serverResponse = code;
            this.code = code.split(':').reverse().pop();
            const datetime = code.split(':').pop();
            let [date, time] = datetime.split(/\s/);
            time = time.split('-').join(':');
            date = date.split('-').join('/');
            const obj = new Date(`${date} ${time}`);

            this.banTime = datetime;
            this.banTimestamp = obj.getTime()/1000;
            this.banDate = obj;
        } else {
            this.code = code;
        }
        this.name = this.constructor.name;
    }
    static check(response) {
        return Object.keys(errorsList).includes(response) && (response.indexOf('BANNED:') !== 0);
    }
}

class getSMS {
    constructor({key, url, service, interval}) {
        if(!key || !url || !service){
            throw new Error('Missing argument(s)')
        }
        if(!['smshub', 'smsactivate'].includes(service)){
            throw new Error('Invalid service name')
        }
        this.key = key;
        this.url = url;
        this.service = service;
        this.interval = interval || 2000;
    }
    async request(qs){
        let url = new URL(this.url)
            url.search = new URLSearchParams(
                Object.assign(qs, {api_key: this.key})
            ).toString();

        return fetch(url)
            .then(async (response) => {
                const data = await response.text();

                if(!ServiceApiError.check(data)){
                    return data;
                } else {
                    throw new ServiceApiError(data);
                }
            });
    }
    getNumbersStatus(country, operator){
        return this.request({action: 'getNumbersStatus', country, operator})
            .then((response) => {
                return JSON.parse(response);
            })
    }
    getBalance(){
        return this.request({action: 'getBalance'})
            .then((response) => {
                const [, balance] = response.split(':');
                const balanceParsed = parseFloat(balance);
                return {
                    balance_string: balance,
                    balance_float: balanceParsed,
                    balance_number: balanceParsed*100
                };
            })
    }
    getMultiServiceNumber(multiService, operator, country, multiForward, ref){
        if(multiService instanceof Object) multiService = multiService.join(',');
        if(multiForward instanceof Object) multiForward = multiForward.join(',');
        return this.request({action: 'getPrices', multiService, operator, country, multiForward, ref})
            .then((response) => {
                return JSON.parse(response);
            })
    }
    getAdditionalService(id, service){
        return this.request({action: 'getAdditionalService', id, service})
            .then((response) => {
                let [, id, number] = response.split(':');
                return {
                    id,
                    number
                };
            })
    }
    getFullSms(id){
        return this.request({action: 'getFullSms', id})
            .then((response) => {
                let [status, text] = response.split(':');
                let res = {
                    status: status
                };
                if(['STATUS_WAIT_CODE', 'STATUS_CANCEL'].includes(status)){
                    return res;
                } else if(status === 'FULL_SMS') {
                    res.text = text;
                    return res;
                }
            })
    }
    getCountries(){
        return this.request({action: 'getCountries'})
            .then((response) => {
                return JSON.parse(response);
            })
    }
    getQiwiRequisites(){
        return this.request({action: 'getQiwiRequisites'})
            .then((response) => {
                return JSON.parse(response);
            })
    }
    getNumber(service, operator, country, forward, phoneException, ref){
        return this.request({action: 'getNumber', service, operator, country, forward, phoneException, ref})
            .then((response) => {
                let [, id, number] = response.split(':');
                return {
                    id,
                    number
                };
            })
    }
    setStatus(status, id){
        return this.request({action: 'setStatus', status, id})
            .then((response) => {
                return {status: response};
            })
    }
    getCode(id){
        return new Promise((resolve, reject) => {
            let interval = setInterval(() => {
                this.getStatus(id).then(({status, code}) => {
                    if (status === 'STATUS_WAIT_CODE') {}

                    if (status === 'STATUS_CANCEL') {
                        clearInterval(interval);
                        resolve({status});
                    }

                    if (status === 'STATUS_OK') {
                        clearInterval(interval);
                        resolve({code});
                    }
                }).catch(err => reject(err));
            }, this.interval);
        });
    }
    getStatus(id){
        return this.request({action: 'getStatus', id})
            .then((response) => {
                if(['STATUS_CANCEL', 'STATUS_WAIT_RESEND', 'STATUS_WAIT_CODE'].includes(response)){
                    return {status: response};
                } else {
                    let [type, code] = response.split(':');
                    if(type === 'STATUS_WAIT_RETRY') {
                        return {status: type, code}
                    }
                    if(type === 'STATUS_OK') {
                        return {status: type, code}
                    }
                    return {status: 'UNKNOWN'};
                }
            })
    }
    getPrices(service, country){
        return this.request({action: 'getPrices', country, service})
            .then((response) => {
                return JSON.parse(response);
            })
    }
}
module.exports = {getSMS, ServiceApiError};