import { getThree } from './THREE';

const modifySource = ( source, hookDefs, hooks )=>{

    let match;

    for( let key in hookDefs ){

        if( hooks[key] ){

            match = /insert(before):(.*)|insert(after):(.*)/.exec( hookDefs[key] );

            if( match ){
                if( match[1] ){ // before
                    source = source.replace( match[2], hooks[key] + '\n' + match[2] );
                }else
                if( match[3] ){ // after
                    source = source.replace( match[4], match[4] + '\n' + hooks[key] );
                }
            }

        }
    }

    return source;

}

let shaderMap = null;
const getShaderDef = ( classOrString )=>{

    let THREE = getThree();

    if( !shaderMap ){

        let classes = {
            standard: THREE.MeshStandardMaterial,
            basic: THREE.MeshBasicMaterial,
            lambert: THREE.MeshLambertMaterial,
            phong: THREE.MeshPhongMaterial,
            depth: THREE.MeshDepthMaterial
        }

        shaderMap = {};

        for( let key in classes ){

            shaderMap[ key ] = {
                ShaderClass: classes[ key ],
                ShaderLib: THREE.ShaderLib[ key ],
                Key: key,
                Count: 0,
                ModifiedName: function(){
                    return `ModifiedMesh${ this.Key[0].toUpperCase() + this.Key.slice(1) }Material_${ this.Count++ }`;
                },
                TypeCheck: `isMesh${ key[0].toUpperCase() + key.slice(1) }Material`
            }

        }
    }

    let shaderDef;

    if( typeof classOrString === 'function' ){
        for( let key in shaderMap ){
            if( shaderMap[ key ].ShaderClass === classOrString ){
                shaderDef = shaderMap[ key ];
                break;
            }
        }
    }else{
        shaderDef = shaderMap[ key ];
    }

    if( !shaderDef ){
        throw new Error( 'No Shader found to modify...' );
    }

    return shaderDef;

}



export default class MaterialModifier{

    constructor(){

        this._vertexHooks = {};
        this._fragmentHooks = {};

    }

    modify( shader, opts ){

        let def = getShaderDef( shader );

        let vertexShader = modifySource( def.ShaderLib.vertexShader, this._vertexHooks, opts.vertexShader || {} );
        let fragmentShader = modifySource( def.ShaderLib.fragmentShader, this._fragmentHooks, opts.fragmentShader || {} );
        let uniforms = Object.assign( {}, def.ShaderLib.uniforms, opts.uniforms || {} );

        return { vertexShader,fragmentShader,uniforms };

    }

    extend( shader, opts ){

        let def = getShaderDef( shader ); // ADJUST THIS SHADER DEF - ONLY DEFINE ONCE - AND STORE A USE COUNT ON EXTENDED VERSIONS.

        let vertexShader = modifySource( def.ShaderLib.vertexShader, this._vertexHooks, opts.vertexShader || {} );
        let fragmentShader = modifySource( def.ShaderLib.fragmentShader, this._fragmentHooks, opts.fragmentShader || {} );
        let uniforms = Object.assign( {}, def.ShaderLib.uniforms, opts.uniforms || {} );

        let ClassName = opts.className || def.ModifiedName();

        let extendMaterial = new Function( 'BaseClass', 'uniforms', 'vertexShader', 'fragmentShader', `

            var cls = function ${ClassName}( params ){

                BaseClass.call( this );

                this.uniforms = Object.assign( {}, uniforms );

                this.vertexShader = vertexShader;
                this.fragmentShader = fragmentShader;
                this.type = '${ClassName}';
                this.setValues( params );

            }

            cls.prototype = Object.create( BaseClass.prototype );
            cls.prototype.constructor = cls;
            cls.prototype.${ def.TypeCheck } = true;

            cls.prototype.copy = function( source ){

                BaseClass.prototype.copy.call( this, source );

                this.uniforms = THREE.UniformsUtils.clone(source.uniforms);
                this.vertexShader = vertexShader;
                this.fragmentShader = fragmentShader;
                this.type = '${ClassName}';

                return this;

            }

            return cls;

        `);

        if( opts.postModifyVertexShader ){
            vertexShader = opts.postModifyVertexShader( vertexShader );
        }
        if( opts.postModifyFragmentShader ){
            fragmentShader = opts.postModifyFragmentShader( fragmentShader );
        }

        return extendMaterial( def.ShaderClass, uniforms, vertexShader, fragmentShader );

    }

    defineVertexHooks( defs ){

        for( let key in defs ){
            this._vertexHooks[ key ] = defs[key];
        }

    }

    defineFragmentHooks( defs ){

        for( let key in defs ){
            this._fragmentHooks[ key ] = defs[key];
        }

    }

}
