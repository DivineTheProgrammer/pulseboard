# PulseBoard

A live-updating dashboard for real, high-frequency market data, built to prove a system can absorb a fast, continuous stream without falling behind or losing data.

Dashboard: https://pulseboard-one-eta.vercel.app
Code: https://github.com/DivineTheProgrammer/pulseboard
Load test findings: https://github.com/DivineTheProgrammer/pulseboard/blob/main/LOAD_TEST_FINDINGS.md

## The problem

A lot of portfolio dashboards fake "real time" with polling, fetching every few seconds and calling it live. That does not prove anything about handling actual load. Real high-frequency data, a live market feed, a busy sensor network, a large user base's activity stream, arrives continuously and unevenly, sometimes a trickle, sometimes a burst, and a system built for it needs to absorb that burst without falling behind or silently dropping events.

I wanted to build the real version of that problem, not a polling loop pretending to be one.

## What it does

PulseBoard connects directly to Binance's live public WebSocket feed and streams real Bitcoin trade data, no mock data generator, no simulated ticks. Every trade gets pushed into a Redis queue, a separate worker process drains that queue in batches and writes the events to a Postgres database, and the dashboard itself receives live updates over a single open connection using Server-Sent Events, so the browser is never polling, it is just listening.

A replay mode lets you scrub back through recent history using the same real data that has already been written to the database, picking a time window and moving a slider through it.

## Architecture

- Next.js and TypeScript for the dashboard, deployed on Vercel
- Two separate, always-on Node.js processes, one connecting to Binance's WebSocket and pushing events into the queue, one draining that queue and writing to the database, deployed on Railway, since these are long-running processes that a serverless platform like Vercel cannot host
- Upstash Redis for the queue, chosen specifically because its REST-based API works correctly in both serverless and traditional environments, rather than requiring a persistent connection
- Supabase for the database, storing every price event with a timestamp, which is what makes the replay feature possible
- The dashboard streams live updates to the browser over Server-Sent Events rather than polling, so new data appears the moment it is written, not on a fixed interval

## The hardest decision

The real architectural decision here was accepting that this project cannot be one deployment. A live WebSocket connection and a continuously polling worker are fundamentally different kinds of workload than a web dashboard, one needs to run forever, the other only needs to respond when asked. Rather than force everything onto Vercel and simulate the streaming parts with a workaround, I split the system properly, the dashboard on Vercel, the two long-running processes on Railway, all pointed at the same real Redis queue and Postgres database. That split is not a limitation, it is the actual correct shape of a system like this, and pretending otherwise would have meant building something that looked real but was not.

## What actually happened during the build

The system was tested against genuine live market data for an extended period, thousands of real Bitcoin trades flowing through the full pipeline. At one point the queue depth climbed into the low thousands while the worker temporarily fell behind ingestion, then drained back to zero as the worker caught up, with no events lost, which is the actual proof that the queue is doing its job.

A deliberate load test, pushing a controlled burst of synthetic events directly into the same queue, was cut short when the Upstash free tier's monthly request quota was fully exhausted by the cumulative traffic from a full day of real testing. Both the load test script and the live worker failed with the same clear, specific error rather than hanging or silently dropping data. The full account of that, and why the organic burst from real trading data is the more honest evidence of the system's throughput, is documented in LOAD_TEST_FINDINGS.md in this repository.

## Status

The dashboard, worker, and ingestion service are all deployed and live right now. The worker and ingestion service will resume processing real data automatically once the Upstash quota resets, no code changes required. Replay mode is unaffected by the quota and works right now against the real historical data already collected.
