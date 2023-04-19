import { nanoid, customAlphabet } from 'nanoid'
import { PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb'
import { ddbDocClient } from './libs/ddbDocClient.js'

const TableName = process.env.TABLE_NAME
const DOMAIN = process.env.DOMAIN

const characters = 'ABCDEFGHJKLMNOPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0123456789'
const getHash = customAlphabet(characters, 4)

export function handler(event) {
  const method = event.requestContext?.http?.method

  switch (method) {
    case 'POST':
      return shortUrl(event.body)
    case 'GET':
      return getLink(event.queryStringParameters.shortUrl)
    default:
      throw new Error(`Unsupported method "${method}"`)
  }
}

async function shortUrl(body) {
  if (!body) return

  const { link } = typeof body === 'string' ? JSON.parse(body) : body

  const randomId = nanoid()
  const putParams = {
    TableName,
    Item: {
      id: randomId,
      link,
      short_url: `${getHash()}`,
      date_created: new Date().toISOString(),
    },
  }
  await ddbDocClient.send(new PutCommand(putParams))

  // https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/javascript_dynamodb_code_examples.html
  const scanParams = {
    TableName,
    FilterExpression: 'id = :id',
    ExpressionAttributeValues: {
      ':id': randomId,
    },
  }
  const res = await ddbDocClient.send(new ScanCommand(scanParams))
  return `${DOMAIN}/${res.Items[0].short_url}`
}

async function getLink(shortUrl) {
  const scanParams = {
    TableName,
    FilterExpression: 'short_url = :short_url',
    ExpressionAttributeValues: {
      ':short_url': shortUrl,
    },
  }
  const res = await ddbDocClient.send(new ScanCommand(scanParams))
  if (res.Items.length > 0) {
    return res.Items[0].link
  }
  return ''
}
