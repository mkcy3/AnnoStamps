describe('Updating Stamp', () => {
  describe('User without username set', () => {
    beforeEach(() => {
      cy.task('db:testUser')
    })
    afterEach(() => {
      cy.task('db:removeTestUser')
    })
    it('unauthorized user redirected to signin page', () => {
      cy.visit('/stamp/update/clll7fyxp002sem82uejwfey5')
      cy.url().should('include', '/auth/signin')
    })
    it('displays alert to set username with link if username not set', () => {
      cy.setSessionCookie()
      cy.visit('/stamp/update/clll7fyxp002sem82uejwfey5')

      cy.findByRole('link', { name: 'Please set your username.' }).should(
        'have.attr',
        'href',
        '/testSeedUserId/settings',
      )
      cy.findByLabelText('Add Images').should('not.exist')
    })
  })
  describe('authorized user with username set', () => {
    beforeEach(() => {
      cy.task('db:testUser', true)
      cy.setSessionCookie()
    })
    afterEach(() => {
      cy.task('db:removeTestUser')
    })
    it('user trying to edit another stamp is denied', () => {
      cy.on('uncaught:exception', (err) => {
        expect(err.message).to.include('Not your stamp')

        // using mocha's async done callback to finish
        // this test so we prove that an uncaught exception
        // was thrown

        // return false to prevent the error from
        // failing this test
        return false
      })

      cy.visit('/')
      cy.getBySel('stamp-card-link')
        .first()
        .invoke('attr', 'href')
        .should('be.a', 'string')
        .invoke('split', '/')
        .its(2)
        .then((id) => {
          cy.visit(`/stamp/update/${id}`, { failOnStatusCode: false })

          cy.findByText('Something went wrong!').should('be.visible')
          cy.findByRole('button', { name: 'Update Stamp' }).should('not.exist')
        })
    })

    it('user can click the edit stamp link and update the stamp', () => {
      cy.intercept('/stamp/update/*').as('updateStamp')

      cy.intercept('GET', '/stamp.zip', {
        fixture: 'test-stamp.zip',
      }).as('getStampZip')

      cy.intercept('/api/upload/*', {
        body: {
          ok: true,
          path: '/stamp.zip',
          url: 'presigned?fileType=zip',
        },
        statusCode: 200,
      }).as('uploadAsset')
      cy.intercept('PUT', '/stamp/update/presigned*', {
        body: '/stamp.zip',
        statusCode: 200,
      }).as('S3Put')
      //FIXME: Need to revalidate the path for [username]
      cy.visit('/stamp/update/testSeed1800StampId')
      cy.wait('@getStampZip')
      cy.findByText('Edit your stamp').should('be.visible')

      cy.findByText('test-stamp-zip').should('exist')
      cy.get('#category').should('have.value', 'cosmetic')
      cy.get('#region').should('have.value', 'old world')
      cy.get('#modded').should('have.value', 'false')
      cy.get('#title').should('have.value', 'Test-Seed-User-Stamp')
      cy.get('#description').should('have.value', 'Test seed user stamp')

      cy.get('#title')
        .type('-Updated')
        .should('have.value', 'Test-Seed-User-Stamp-Updated')

      cy.findByRole('button', { name: 'Update Stamp' }).click()
      cy.findByText('Creating Stamp...').should('be.visible')
      cy.wait(['@uploadAsset', '@S3Put'])
      cy.wait('@updateStamp').its('response.statusCode').should('eq', 200)

      cy.url().should('include', '/testseeduser')
      cy.findByRole('heading', { name: 'Test-Seed-User-Stamp-Updated' })
      cy.database(
        `SELECT * FROM "Stamp" WHERE title = 'Test-Seed-User-Stamp-Updated';`,
      ).then((stamps) => {
        const stamp = stamps[0]
        cy.wrap(stamp).its('userId').should('eq', 'testSeedUserId')
      })
    })
  })
})
