# System Design

*How to engineer a piece of software.*

## Requisites

Requirements Engineering:

1. talk with people and get what they want
    
    [Requirements Engineering](../Requirements%20Engineering%201fcfdf535bef80eabc11e9c37a171a60.md)
    
2. define a specific set of functionalities **WE** want to build
3. prioritize them; categorize as functional and non-functional
4. generate Use-Case Diagram

Analyze the Requirements: let's take each of the requirements previously defined: shape what the user does with our app and fix how we want the user interaction (no details about UI, just what we want specifically).

## Problem

1. **Problem Analysis**: gather our Requirements into buckets of functionalities (ex: Profile, story creation, story consumption...).
For each of these, write down the content we want to gather from them and the input output interaction of our system. Fit between functionalities and UIs. Match theoretical functionalities to practical ones. Define the external systems. Define roles..
    1. **Table of Functionalities**
        1. Interaction user-platform with Obligatory passages
        2. Information Flux: list all used informations
    2. **Roles Table**
        1. roles of access for functionalities and information
2. **Domain Model**
    1. UML: class, attributes, relations, ...
3. **Logical Architecture**: gather together functionalities and the model, with a high level definition of the system parts and a precise (also visually) definition of the user interaction with it.
4. Testing plan

## Design

Gather all shit up to design.

- Software architecture
- Detail software functionality definition
- Interface
- Persistence (ex: database / logs)
- DEPLOYMENT