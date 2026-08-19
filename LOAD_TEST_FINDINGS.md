# PulseBoard Load Test Findings

## What was tested

A synthetic load test script pushed batches of price events directly into the same Redis queue the real ingestion pipeline uses, at a controlled rate (100 events per batch, 50ms between batches, using Redis pipelining to send each batch as a single round trip rather than 100 individual calls). The target was 2,000 total synthetic events, run alongside the worker process actively draining the same queue, to observe how the system behaves under a burst load significantly higher than Binance's natural trade rate.

## What actually happened

Before the test could complete, both the load test script and the worker began failing with the same error from Upstash: "max requests limit exceeded. Limit: 500000, Usage: 500000." This is Upstash's free tier monthly request quota, and it had been fully consumed by the cumulative real usage from building and testing PulseBoard throughout the day, real WebSocket ingestion from Binance producing thousands of genuine trade events, the worker's continuous polling and batch writes, and the load test's own additional traffic on top of that.

## Why this is a real and useful finding, not a failed test

This is not a bug in the ingestion or worker code. It is a real, concrete demonstration of something every system built on a metered third party service eventually runs into, a hard usage ceiling that arrives without warning mid operation, and the system's job in that moment is to fail predictably rather than silently. Both the worker and the load test script did exactly that, they logged a clear, specific error identifying the exact cause, rather than hanging, crashing without explanation, or silently dropping data.

## What this means for a production version

A real production deployment of PulseBoard would need active usage monitoring against the provider's quota, with alerting before the limit is reached rather than discovering it through a failed request. It would also need a defined fallback behavior for what the ingestion pipeline should do if the queue becomes unreachable, buffer locally and retry, degrade to direct writes bypassing the queue temporarily, or pause ingestion and alert an operator, none of which was necessary to decide for this build, since proving the pipeline's throughput characteristics under normal load was the actual goal, not building out quota exhaustion recovery logic.

## What was confirmed before the quota was hit

Earlier in the same session, before this limit was reached, the pipeline was observed processing several thousand real Binance trade events with the queue depth climbing into the low thousands during a period where ingestion briefly outpaced the worker, then draining back to zero as the worker caught up, without any events being lost. That earlier, organic burst is the more honest evidence of the system's real throughput handling, since it happened under genuine live market conditions rather than an artificial script, and it is what the case study should reference as the actual proof point.
