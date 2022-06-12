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
