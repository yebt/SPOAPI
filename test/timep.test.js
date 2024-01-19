const waitFunct = async (msg, waitTime = 1) => {
  await new Promise(resolve => setTimeout(resolve, waitTime * 100))
  console.log(msg)
  return 1
}

const asyncCall = async () => {
  // test normal for
  for (let i = 0; i < 10; i++) {
    console.log('Start: ' + i)
    await waitFunct('Finish' + i, i)
  }
  console.log('End')
}

asyncCall()
