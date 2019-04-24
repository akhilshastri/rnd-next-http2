// const fastify = require('fastify')({ logger: { level: 'error' } });

const Fastify = require('fastify');
const fs = require('fs');
// https is necessary otherwise browsers will not
// be able to connect
const fastify = Fastify({
  http2: true,
  https: {
    key: fs.readFileSync(  './.certs/server.key'),
    cert:  fs.readFileSync('./.certs/server.crt')
  }
});

const Next = require('next');

const port = parseInt(process.env.PORT, 10) || 3000;
const dev = process.env.NODE_ENV !== 'production';


const pathWrapper = (app, pathName, opts) => async ({ raw, query, params }) => {
    return app.renderToHTML(
        raw.req,
        raw.res,
        pathName,
        { ...query, ...params },
        opts
    )
};

fastify.register((fastify, opts, next) => {
  const app = Next({ dev });


   const renderToHTML = async  ( req, res, pathname, query) =>{
        try {
            const out = await app.renderToHTML(req, res, pathname, query) ;
            return out
        } catch (err) {
            if (err.code === 'ENOENT') {
                res.statusCode = 404 ;
                return app.renderErrorToHTML(null, req, res, pathname, query)
            } else {
                console.error(err) ;
                res.statusCode = 500;
                return app.renderErrorToHTML(err, req, res, pathname, query)
            }
        }
    }

  app
    .prepare()
    .then(() => {
      if (dev) {
        fastify.get('/_next/*', (req, reply) => {
          return app.handleRequest(req.req, reply.res).then(() => {
            reply.sent = true
          })
        })
      }

      fastify.get('/a', (req, reply) => {
        return app.render(req.req, reply.res, '/a', req.query).then(() => {
          reply.sent = true
        })
      });

      fastify.get('/b', (req, reply) => {

          try {
              req.raw.stream.pushStream({
                  ':path': '/c'
              }, function (err, stream) {
                  if (err) {
                      req.log.warn(err);
                      return
                  }
                  // renderToHTML(req.req,reply.res, '/c').then(html=>{
                      stream.respond({':status': 200});
                      stream.end('<div> <h1>new page </h1> </div> </div>');

                  // }) ;
              });
          } catch (e) {
              console.error(e);
          }


        return app.render(req.req, reply.res, '/b', req.query).then(() => {
          reply.sent = true
        })
      });

      fastify.get('/*', (req, reply) => {
        return app.handleRequest(req.req, reply.res).then(() => {
          reply.sent = true
        })
      }) ;

        fastify.get('/fastify', async (request, reply) => {
            request.raw.stream.pushStream({
                ':path': '/a/resource'
            }, function (err, stream) {
                if (err) {
                    request.log.warn(err);
                    return
                }
                stream.respond({ ':status': 200 });
                stream.end('content');
            });

            return 'Hello World!';
        });

      fastify.setNotFoundHandler((request, reply) => {
        return app.render404(request.req, reply.res).then(() => {
          reply.sent = true
        })
      });


      next()
    })
    .catch(err => next(err))
}) ;

fastify.listen(port, err => {
  if (err) throw err
  console.log(`> Ready on http://localhost:${port}`)
})
