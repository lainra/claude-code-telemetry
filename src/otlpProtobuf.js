/**
 * Decodes OTLP http/protobuf request bodies into the same shape as OTLP http/json.
 */

const path = require('path')
const protobuf = require('protobufjs')

const PROTO_DIR = path.join(__dirname, '..', 'proto')
const COLLECTOR = 'opentelemetry/proto/collector'

const root = new protobuf.Root()
root.resolvePath = (_origin, target) => path.join(PROTO_DIR, target)
root.loadSync([
  `${COLLECTOR}/trace/v1/trace_service.proto`,
  `${COLLECTOR}/metrics/v1/metrics_service.proto`,
  `${COLLECTOR}/logs/v1/logs_service.proto`,
])

const REQUEST_TYPES = {
  '/v1/traces': root.lookupType('opentelemetry.proto.collector.trace.v1.ExportTraceServiceRequest'),
  '/v1/metrics': root.lookupType('opentelemetry.proto.collector.metrics.v1.ExportMetricsServiceRequest'),
  '/v1/logs': root.lookupType('opentelemetry.proto.collector.logs.v1.ExportLogsServiceRequest'),
}

// Match OTLP/JSON: 64-bit ints as strings, enums as numbers, empty repeated fields kept
const TO_OBJECT_OPTIONS = { longs: String, enums: Number, bytes: String, arrays: true, defaults: false }

function isProtobufRequest(req) {
  return (req.headers['content-type'] || '').toLowerCase().includes('application/x-protobuf')
}

function decodeOtlpProtobuf(url, body) {
  const type = REQUEST_TYPES[url]
  if (!type) return null
  return type.toObject(type.decode(body), TO_OBJECT_OPTIONS)
}

module.exports = { isProtobufRequest, decodeOtlpProtobuf }
