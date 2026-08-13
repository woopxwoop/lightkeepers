---
title: Merry Christmas
date: 2026-08-13
summary: Add video links for Stygian recommendations, build goals for simmed characters, alter Stygian algorithm (read full notes)
---

## Stygian clear videos

Inside /tools/stygian, added a button to display clears using the teams suggested - of course some teams will not have clears.

## Stygian algorithm improvement (?)

Inside /tools/stigian, added a dropdown to select different algorithms for recommending Stygian teams.

Usage Rate: the previous algorithm, used usage rate to rank teams and solutions

Video Clears C0R0: algorithm that only suggests teams with C0R0 recorded clears (restrictive due to sample size)

Hybrid (New): combines usage rate and video clears - prioritizes solutions with video clears while also using usage rate.

Testing using Hybrid by default to see how effective it ends up being. Feedback appreciated.

## Build goals

Inside /characters/{name}, added stat goals for most characters implemented in gcsim. Updated automatically as more characters get implemented.
